# InnoDB 页结构

理解 MySQL 的底层存储结构，是掌握性能优化的必经之路。

数据在磁盘上不是一条一条存的——MySQL 以**页（Page）**为单位读写磁盘，每页默认 16KB。索引的 B+ 树，也是以页为基本单位组织起来的。

---

## InnoDB 存储结构的全景图

从宏观到微观，InnoDB 的存储结构分为四个层次：

```
表空间（Tablespace）
└── 段（Segment）
    └── 区（Extent，64个页 = 1MB）
        └── 页（Page，16KB，默认大小）
            └── 行（Row，数据）
```

理解这四层关系，才能明白一条数据到底存在哪里、索引是怎么关联数据的。

---

## 数据页的 7 个组成部分

InnoDB 的数据页（也叫 INDEX 页）长这样：

```
┌─────────────┬──────────────┬───────────────┬──────────────┐
│  File Header │ Page Header │ Infimum+      │              │
│  (38 bytes) │ (56 bytes)  │ Supremum Record│ User Records │
│            │            │ (26 bytes)     │   (行记录)    │
├─────────────┴──────────────┴───────────────┼──────────────┤
│  Free Space    │  Page Directory   │ File Trailer  │
│  (空闲空间)    │   (页目录)        │ (8 bytes)   │
└─────────────────────────────────────────────────┘
```

| 组成部分 | 大小 | 作用 |
|-------|-----|------|
| File Header | 38 字节 | 页的元信息：checksum、上一页/下一页指针（链表） |
| Page Header | 56 字节 | 页内统计：行数、第一个自由空间指针、碎片数等 |
| Infimum + Supremum | 26 字节 | 伪记录：比任何数据都小/大的边界值 |
| User Records | 可变 | 用户存储的实际数据行 |
| Free Space | 可变 | 尚未使用的空间 |
| Page Directory | 可变 | 页目录：行的快捷索引（二分查找用） |
| File Trailer | 8 字节 | 页校验：检测页是否完整写入 |

### File Header：页与页之间的链表

InnoDB 的数据页之间通过双向链表连接：

```
上一页(File Header) ←→ 当前页 ←→ 下一页(File Header)
```

- 双向链表实现**范围查询**（不需要回到根节点）
- 全表扫描时，MySQL 顺着链表遍历所有页

### Infimum + Supremum：伪记录

每页有两条虚构的记录：

- **Infimum**：比任何用户记录都小的"最小记录"
- **Supremum**：比任何用户记录都大的"最大记录"

这两条记录固定存在于每页中，用于 Page Directory 的二分查找。

### Page Directory：页内行索引

Page Directory 是页内记录的"目录"——它把页内所有记录分组，每组选取一个代表（大值）放在 Page Directory 中。

```
Page Directory：
[0] → Infimum (最小代表)
[1] → 第5条记录的主键
[2] → 第10条记录的主键
[3] → Supremum (最大代表)
```

查找时用二分：先在 Page Directory 中找到粗略位置，再到组内线性查找。

> **为什么要有 Page Directory？**
> 如果页内有 200 条记录，线性查找最坏 200 次。有了 Page Directory（二分到组），组内最多 4~8 条，大幅减少比较次数。

---

## 记录头信息（Record Header）

每条用户记录都带有一个**记录头（record header）**，占 5 字节，存储元数据：

```sql
-- 查看表结构
DESC employees;

-- 完整行格式（见下一节）
-- 这里关注行头部的字段含义
```

关键字段：

| 字段 | 大小 | 含义 |
|-----|-----|------|
| deleted_flag | 1 bit | 逻辑删除标记（0=未删，1=已删） |
| min_rec_flag | 1 bit | 是否为 B+ 树非叶子节点的最小记录 |
| n_owned | 4 bits | 该记录所在组的记录数 |
| heap_no | 13 bits | 在堆中的序号 |
| record_type | 2 bits | 记录类型（0=普通，1=B+树非叶节点，2=Infimum，3=Supremum） |
| next_record | 16 bits | 下一条记录的位置偏移 |

### next_record：记录之间的链表

**next_record** 是 MySQL 行格式的灵魂——它把所有记录串成一条单向链表，按主键顺序排列：

```
记录A.next_record → 指向记录B的地址
记录B.next_record → 指向记录C的地址
...
记录Z.next_record → null（末尾）
```

插入和删除时，MySQL 只需要修改相邻几条记录的 next_record 指针，代价很小。

---

## 最小记录与最大记录（Infimum/Supremum）

Infimum 和 Supremum 是 InnoDB 页内的两个锚点：

| 伪记录 | 值 | 作用 |
|-------|-----|------|
| Infimum | 比任何用户记录都小 | 链表头部 |
| Supremum | 比任何用户记录都大 | 链表尾部 |

查找 `WHERE id = 15` 时：

1. 先在 Page Directory 二分，找到可能所在的组
2. 从 Infimum 开始，沿着 next_record 遍历，直到找到目标或超过 Supremum

---

## 页的分配与回收

### Page Header 中的关键统计

| 字段 | 说明 |
|-----|------|
| PAGE_N_DIR_SLOTS | Page Directory 中的槽数（分组数量） |
| PAGE_N_HEAP | 堆中的记录数（包括 Infimum 和 Supremum） |
| PAGE_FREE | 指向第一个空闲空间的指针 |
| PAGE_GARBAGE | 已删除记录占用的空间（可回收） |
| PAGE_LAST_INSERT | 最后插入记录的位置 |
| PAGE_DIRECTION | 插入方向（左边/右边） |
| PAGE_N_RECS | 当前页的用户记录数 |

### 空间回收

逻辑删除的行（deleted_flag=1）不会立即释放空间，而是放入**垃圾链表（garbage list）**。空间积累到一定程度后，`PAGE_GARBAGE` 增大，可以通过 `OPTIMIZE TABLE` 回收。

---

## 数据页在 B+ 树中的角色

B+ 树的节点有两种：

- **非叶子节点**：存储索引键值和指向下层的指针（不含数据）
- **叶子节点**：存储完整数据行（聚簇索引）或主键值+索引键（二级索引）

```
B+ 树结构：
                    [根节点：页结构相同，无用户数据]
                    /          \
           [非叶子节点]        [非叶子节点]
           (索引值+指针)       (索引值+指针)
           /    |    \         /    |    \
        [页1] [页2] [页3]   [页4] [页5] [页6]
         ↓      ↓     ↓      ↓     ↓     ↓
       数据   数据  数据   数据  数据  数据
     (叶子节点，叶子节点也是页结构)
```

> 重点：B+ 树的**所有叶子节点在同一层**，通过双向链表相连——这就是 MySQL 能够高效范围查询的底层原因。

---

## 实战：查看页信息

MySQL 8.0 提供了 `INFORMATION_SCHEMA.INNODB_TABLES` 查看表空间信息：

```sql
-- 查看表的表空间信息
SELECT 
    TABLE_NAME,
    SPACE,
    ROW_FORMAT,
    TABLE_ROWS,
    AVG_ROW_LENGTH,
    DATA_LENGTH,
    INDEX_LENGTH
FROM information_schema.TABLES
WHERE TABLE_SCHEMA = 'shop'
  AND TABLE_NAME = 'orders';

-- 查看缓冲池中缓存的页数
SELECT 
    POOL_ID,
    PAGES_DATA,
    PAGES_DIRTY,
    PAGES_FLUSHED
FROM information_schema.INNODB_BUFFER_POOL_STATS
WHERE POOL_ID = 0;
```

---

## 小结

InnoDB 页结构是理解 MySQL 存储机制的根基：

| 组件 | 作用 |
|-----|------|
| File Header | 页的元信息 + 前后页链表指针 |
| Page Directory | 页内二分查找目录 |
| User Records | 实际数据行 + next_record 链表 |
| Infimum/Supremum | 链表头尾锚点 |

记住：**B+ 树的每一层节点都是一个页**，数据以页为单位在内存和磁盘之间传输。理解页，就理解了 MySQL 的 I/O 成本。

---

## 下一步

页内数据是如何组织的？Compact 和 Dynamic 行格式有什么区别？行溢出是怎么发生的？

从 [行格式](/database/mysql/optimize/innodb/row-format) 继续。
