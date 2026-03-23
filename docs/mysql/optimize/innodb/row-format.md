# InnoDB 行格式

一条数据在页内是怎么存储的？不同的行格式（Row Format）决定了数据的存储方式和空间效率。

---

## 四种行格式

InnoDB 支持四种行格式，通过 `ROW_FORMAT` 指定：

| 行格式 | 特点 | MySQL 版本 |
|-------|------|-----------|
| Compact | MySQL 5.0 引入，节省空间 | 5.0+ |
| Redundant | 老格式，兼容 MySQL 5.0 之前 | 所有版本 |
| Dynamic | MySQL 5.7 默认，极端情况下行溢出处理更优雅 | 5.7+ |
| Compressed | 支持压缩，适合只读/归档表 | 5.0+ |

MySQL 5.7+ 默认使用 **Dynamic** 行格式。

```sql
-- 查看表的行格式
SHOW TABLE STATUS LIKE 'employees';

-- 查看行格式配置
SHOW VARIABLES LIKE 'innodb_default_row_format';
-- 结果：dynamic
```

---

## Compact 行格式详解

Compact 是最经典的行格式，理解了它，其他格式就容易理解了。

### Compact 行格式结构

一条记录在 Compact 格式下分为三个部分：

```
┌──────────────────┬──────────────────────────────────────────────┐
│   变长字段长度列表  │   NULL 值列表   │   记录头信息  │   列值数据  │
│  (1~2 bytes/字段) │   (0~1 bytes)   │   (5 bytes)  │  (实际数据)  │
└──────────────────┴─────────────────┴─────────────┴──────────────┘
```

### 1. 变长字段长度列表

只记录**变长类型字段**（VARCHAR, TEXT, BLOB）的实际长度。

```sql
CREATE TABLE t_demo (
    id INT,                      -- 定长字段，不在此列表
    name VARCHAR(10),            -- 变长字段
    email VARCHAR(50),           -- 变长字段
    status TINYINT               -- 定长字段，不在此列表
);
```

存储 `"Tom"` (3字节) 和 `"test@example.com"` (17字节) 时：

```
变长字段长度列表：0x11 0x03
                  ↑     ↑
              email  name
              17    3
```

> **逆序存储**：Compact 格式把字段长度**逆序**放入列表——离表头越近的字段，长度值越靠后。这是历史兼容的设计。

### 2. NULL 值列表

允许 NULL 的列，不存储实际值，而是在 NULL 值列表中用二进制位标记。

```sql
CREATE TABLE t_null_demo (
    id INT NOT NULL,
    name VARCHAR(20) NOT NULL,
    email VARCHAR(50),    -- 允许 NULL
    phone VARCHAR(20)     -- 允许 NULL
);
```

存储时：

```
NULL 值列表：00 01
              ↑  ↑
          phone email
           0    1   (0=非NULL, 1=NULL)
```

- `id` 和 `name` 是 NOT NULL，不在 NULL 列表中
- `phone` 非空（0），`email` 为空（1）

### 3. 记录头信息（5 字节）

之前讲页结构时提到的 record_header：

| 字段 | 位数 | 说明 |
|-----|-----|------|
| deleted_flag | 1 | 逻辑删除标记 |
| min_rec_flag | 1 | B+ 树节点最小记录标记 |
| n_owned | 4 | 所在分组的记录数 |
| heap_no | 13 | 堆中的序号 |
| record_type | 2 | 0=普通，1=非叶节点，2=Infimum，3=Supremum |
| next_record | 16 | 下一条记录的偏移 |

### 4. 列值数据

真实数据按列顺序存储。定长字段（CHAR, INT, DATETIME）直接存储；变长字段只存实际内容（不带填充空格）。

> **CHAR 的陷阱**：CHAR(n) 在 InnoDB 中是变长存储——存储 ASCII 字符时，实际只占用实际字符数，而不是 n 个字节。

---

## Dynamic 行格式

MySQL 5.7 将 Dynamic 设为默认行格式。相比 Compact，Dynamic 对**行溢出**的处理更加优雅。

### 什么是行溢出

InnoDB 的页大小是 16KB，一行数据理论上不能超过页的大小。但 VARCHAR(65535) 理论上可以存 64KB——这就会发生**行溢出（Row Overflow）**。

#### Compact 的处理方式

一条 VARCHAR 字段数据超过 20 字节时，Compact 只在当前页存储前 768 字节 + 20 字节的溢出页指针：

```
当前页：
┌──────────────────────────┐
│ 列值前 768 字节           │ ← 开头部分
│ (溢出页指针: 20字节)      │ ← 指向溢出页
└──────────────────────────┘
溢出页（BLOB Page）：
┌──────────────────────────┐
│  列值剩余的 64000+ 字节   │
└──────────────────────────┘
```

#### Dynamic 的处理方式

Dynamic 不存储前 768 字节，直接存储溢出页指针：

```
当前页：
┌──────────────────────────┐
│  溢出页指针 (20字节)      │ ← 不存行数据，只存指针
└──────────────────────────┘
```

> **为什么 Dynamic 不存开头部分？**
> 如果一行大部分数据在溢出页，读取时还是要多次 I/O——既然要读溢出页，那开头部分存不存无所谓了。不如全部放到溢出页，减少当前页的碎片。

### 行溢出条件

触发行溢出的是**单列长度**，不是整行长度：

| 字段类型 | 触发溢出长度 |
|---------|------------|
| VARCHAR(n) | n > (65535 - 2) / 字符集字节数 |
| TEXT/BLOB | 可能溢出（Dynamic 全部溢出） |
| VARCHAR(10000) 中文 | 10000 × 3 = 30000 > 16384，溢出 |

```sql
CREATE TABLE t_overflow (
    id INT,
    content VARCHAR(10000)   -- 中文场景下必然溢出
);
```

### 避免行溢出的方式

- 用 TEXT/BLOB 替代超长 VARCHAR（强制溢出，但不占行内空间）
- 合理拆分字段（把大字段单独建表，用外键关联）
- 使用压缩（COMPRESSED 行格式）

---

## Redundant 行格式（了解即可）

MySQL 5.0 之前的格式，现在基本不使用。结构上比 Compact 更宽松：

- 用字段偏移数组代替变长字段长度列表
- 没有 NULL 值列表，直接在列值中存储 NULL
- 占用空间比 Compact 大 10%~20%

```sql
ALTER TABLE t_demo ROW_FORMAT = REDUNDANT;
```

---

## Compressed 行格式

支持 ZLIB 压缩，适合以下场景：

- 很少更新的只读/归档数据
- 存储重复内容多的表（如日志、消息记录）
- 磁盘空间紧张但 CPU 充裕

```sql
ALTER TABLE log_messages ROW_FORMAT = COMPRESSED;
```

> **代价**：压缩和解压有 CPU 开销，高写入量场景慎用。

---

## 行格式对性能的影响

| 维度 | Compact | Dynamic | Compressed |
|-----|--------|---------|-----------|
| 空间效率 | 高 | 极高 | 最高（压缩后） |
| 行溢出处理 | 存前768字节 | 全溢出 | 全溢出+压缩 |
| CPU 开销 | 低 | 低 | 中高 |
| 适用场景 | 通用 | 默认首选 | 只读/归档 |

---

## 查看行格式

```sql
-- 方法一：SHOW TABLE STATUS
SHOW TABLE STATUS LIKE 'employees'\G

-- 方法二：INFORMATION_SCHEMA
SELECT TABLE_NAME, ROW_FORMAT 
FROM information_schema.TABLES 
WHERE TABLE_SCHEMA = 'shop';

-- 方法三：查看建表语句
SHOW CREATE TABLE employees\G
```

---

## 小结

行格式决定了数据在页内的存储方式：

- **Compact**：经典格式，存列长度列表和 NULL 标记，溢出时存前 768 字节
- **Dynamic**：当前默认，溢出时全放溢出页，减少碎片
- **Compressed**：在 Dynamic 基础上压缩，适合只读数据

理解行格式，才能理解为什么超长 VARCHAR 会拖慢查询——行溢出意味着额外的 I/O。

---

## 下一步

数据页是怎么组成区、段、表空间的？表空间结构是怎样的？

从 [表空间结构](/database/mysql/optimize/innodb/space) 继续。
