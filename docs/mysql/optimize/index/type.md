# 索引类型

大多数人对索引的理解止步于"在字段上加个索引"。但 MySQL 的索引体系远比这复杂——不同的索引类型，适合不同的场景，用错了反而拖累性能。

---

## B+ 树索引：MySQL 的主流选择

MySQL（InnoDB 引擎）的索引默认使用 **B+ 树**作为数据结构。

### B+ 树长什么样

B+ 树是一种自平衡的多路搜索树，有以下特点：

```
                    [60]
               /          \
         [20 | 40]       [80 | 90]
         /  |  \         /  |   \
     [5] [25][45]   [65][85][95][100]
      ↓    ↓   ↓      ↓    ↓    ↓    ↓
    数据  数据 数据   数据  数据  数据  数据
    (叶子节点层，用双向链表连接)
```

关键特征：

- **所有数据都在叶子节点**：非叶子节点只存储索引值和指针，不存储实际数据
- **叶子节点用链表相连**：范围查询可以直接在叶子节点链表上遍历，无需回溯
- **多路平衡**：每个节点可以有多个子节点（度为 m），树的高度控制在 3~5 层
- **所有索引值有序**：左子树 < 根节点 < 右子树

### 为什么 MySQL 选择 B+ 树

| 对比维度 | B+ 树 | B 树 | 红黑树 | Hash |
|--------|-------|------|--------|------|
| 树高 | 低（3~5层） | 低 | 高（log n层，每层2叉） | O(1) |
| 范围查询 | 优秀（链表遍历） | 一般 | 差 | 差 |
| 磁盘 I/O | 少（节点大小≈页大小） | 少 | 多 | - |
| 稳定性 | 稳定 | 稳定 | 不稳定 | 碰撞退化 |

B+ 树一个节点的大小正好等于 InnoDB 一页（16KB），每次磁盘 I/O 读一页，三到四次 I/O 就能查到任何数据——这就是 MySQL 选择它的根本原因。

---

## 聚簇索引 vs 二级索引

这是 MySQL（InnoDB）最核心的索引概念，也是面试必问题。

### 聚簇索引（Clustered Index）

**聚簇索引** = 索引和数据融为一体。

在 InnoDB 中，聚簇索引的叶子节点存储的是完整的行数据：

```
聚簇索引结构：
[主键值] → [完整行数据（id, name, age, email...）]

主键 = 聚簇索引键
```

特点：
- 每个表只能有一个聚簇索引（因为数据只能按一种方式物理排序）
- 主键默认是聚簇索引键
- 如果没有主键，MySQL 选择第一个 UNIQUE 非空索引作为聚簇索引
- 如果没有合适的索引，InnoDB 会生成一个隐藏的 6 字节 Row ID 作为聚簇索引

### 二级索引（Secondary Index）

**二级索引**（也叫辅助索引）的叶子节点只存储索引键和主键值：

```
二级索引结构（以 name 为例）：
[name='Tom'] → [主键值: 15]
[name='Amy'] → [主键值: 22]
```

查询流程：

1. 先在二级索引中找到目标记录，获取主键值
2. 再拿主键值回聚簇索引查完整数据（**回表**）

这个"回表"过程是有代价的——如果查询的字段不在二级索引中，就需要回表，I/O 成本翻倍。

### 聚簇 vs 二级对比

| 特性 | 聚簇索引 | 二级索引 |
|-----|--------|---------|
| 叶子节点存什么 | 完整行数据 | 主键值 |
| 查询是否回表 | 否（直接返回） | 可能需要 |
| 查询速度 | 快 | 慢（多一次 I/O） |
| 插入速度 | 慢（可能页分裂） | 快 |
| 空间占用 | 小（数据+索引合一） | 独立存储 |
| 数量限制 | 1 个/表 | 多个/表 |

### 设计启示

**主键设计影响性能**：

```sql
-- 自增主键（推荐）：插入顺序与物理存储顺序一致，避免页分裂
CREATE TABLE orders (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,  -- 聚簇键
    ...
) ENGINE=InnoDB;

-- UUID 主键（不推荐）：随机插入，极易触发页分裂
CREATE TABLE orders (
    id CHAR(36) PRIMARY KEY,  -- 聚簇键
    ...
) ENGINE=InnoDB;
```

---

## 联合索引（复合索引）

**联合索引**是指在多个列上创建的索引，形式为 `INDEX idx(a, b, c)`。

### 最左前缀原则

这是联合索引最核心的概念，也是最容易踩坑的地方。

```sql
CREATE INDEX idx_name_age_dept ON employees(name, age, dept_id);
```

MySQL 会从左到右使用索引中的列，**必须从第一列开始，不能跳过**：

| 查询条件 | 是否使用索引 | 说明 |
|---------|------------|------|
| `WHERE name = 'Tom'` | ✅ 使用 | 命中第一列 |
| `WHERE name = 'Tom' AND age = 30` | ✅ 使用 | 命中前两列 |
| `WHERE name = 'Tom' AND age = 30 AND dept_id = 5` | ✅ 使用 | 全部命中 |
| `WHERE age = 30` | ❌ 不使用 | 跳过第一列 |
| `WHERE name = 'Tom' AND dept_id = 5` | ⚠️ 部分使用 | 只用 name |
| `WHERE name LIKE 'T%' AND age = 30` | ✅ 使用 | 左侧是范围 |

### 索引列顺序选择原则

**区分度高的列放前面**：

```sql
-- 场景：员工表，经常按 name 或 department 查询
-- 分析：name 区分度高（几千个不同值），department 区分度低（只有10个部门）

-- ✅ 正确：区分度高的放前
CREATE INDEX idx_name_dept ON employees(name, department);

-- ❌ 错误：区分度低的放前，效果差
CREATE INDEX idx_dept_name ON employees(department, name);
```

### 覆盖索引：避免回表

如果查询的所有字段都包含在索引中，就不需要回表，性能大幅提升：

```sql
-- 索引：INDEX idx_name_age (name, age)
SELECT name, age FROM employees WHERE name = 'Tom';
--                                    ↑    ↑
--                         查询的字段全在索引中，无需回表
```

这就是**覆盖索引**（Covering Index）的威力。

---

## Hash 索引

Hash 索引底层使用 Hash 表，适合等值查询（`=`、`IN`），但不支持范围查询和排序。

### InnoDB 的自适应 Hash 索引

InnoDB 不会自动为你的字段创建 Hash 索引，但会**自适应地**在 B+ 树索引上建立 Hash 索引（Adaptive Hash Index, AHI）。

```sql
-- 查看自适应 Hash 索引状态
SHOW ENGINE INNODB STATUS\G
-- 在输出中查找 "hash searches" 相关统计
```

### 手动创建 Hash 索引

MySQL 原生不支持在普通字段上创建 Hash 索引，但 Memory 存储引擎可以：

```sql
CREATE TABLE t_test (
    id INT,
    name VARCHAR(50),
    INDEX idx_name_hs (name) USING HASH
) ENGINE=MEMORY;
```

### Hash 索引 vs B+ 树

| 特性 | Hash 索引 | B+ 树索引 |
|-----|---------|----------|
| 等值查询 | O(1)，极快 | O(log n) |
| 范围查询 | ❌ 不支持 | ✅ 支持 |
| 排序 | ❌ 不支持 | ✅ 支持 |
| 最左前缀 | ❌ 不适用 | ✅ 适用 |
| 内存占用 | 高（需全量索引） | 低（按需加载） |

---

## 全文索引（Full-Text Index）

用于在大量文本中快速搜索关键词，MyISAM 和 InnoDB（5.6+）都支持。

```sql
CREATE TABLE articles (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(200),
    content TEXT,
    FULLTEXT INDEX ft_title_content (title, content)
) ENGINE=InnoDB;

-- 使用 MATCH ... AGAINST 进行全文搜索
SELECT * FROM articles
WHERE MATCH(title, content) AGAINST('MySQL 索引优化');
```

### 全文索引 vs LIKE %xxx%

| 对比 | LIKE %keyword% | 全文索引 |
|-----|---------------|---------|
| 性能 | 全表扫描，慢 | 倒排索引，快 |
| 中文支持 | 一般 | 需要配合分词器（如 ngram） |
| 模糊匹配 | ✅ | ⚠️ 英文天然分词，中文需配置 |

---

## 主键索引、唯一索引、普通索引

### 三者区别

| 类型 | 特点 | 数量 |
|-----|------|-----|
| 主键索引 | 非空且唯一，聚簇索引 | 1 个/表 |
| 唯一索引 | 值唯一，允许空值 | 多个/表 |
| 普通索引 | 值可以重复，无特殊约束 | 多个/表 |

```sql
-- 主键索引（聚簇）
CREATE TABLE t1 (
    id INT PRIMARY KEY
);

-- 唯一索引（也是二级索引）
CREATE UNIQUE INDEX uk_name ON t1(name);

-- 普通索引
CREATE INDEX idx_dept ON t1(department);
```

---

## 小结

索引类型的选择取决于业务场景：

- **大多数场景**：B+ 树索引够用，普通索引 + 覆盖索引优化
- **等值查询极多的场景**：考虑自适应 Hash 索引
- **文本搜索**：全文索引
- **范围查询 + 排序**：B+ 树联合索引，遵循最左前缀

理解聚簇索引和二级索引的区别，是性能优化的起点——所有回表代价、覆盖索引优化，都建立在这个基础之上。

---

## 下一步

索引怎么创建、删除和管理？降序索引和隐藏索引有什么用？

从 [索引操作](/database/mysql/optimize/index/ops) 继续。
