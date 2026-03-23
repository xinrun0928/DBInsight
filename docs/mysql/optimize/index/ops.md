# 索引操作

知道索引是什么、有什么用之后，接下来要学会怎么用——创建、删除、修改，以及 MySQL 8.0 引入的降序索引和隐藏索引。

---

## 索引分类体系回顾

在动手操作之前，先理清 MySQL 索引的分类：

```
索引
├── 按数据结构
│   ├── B+ 树索引（默认，InnoDB）
│   ├── Hash 索引（Memory/自适应）
│   └── R-Tree 索引（空间数据）
├── 按物理存储
│   ├── 聚簇索引（主键，数据+索引合一）
│   └── 二级索引（辅助，索引+主键）
├── 按字段个数
│   ├── 单列索引
│   └── 联合索引（复合索引）
└── 按唯一性
    ├── 主键索引（唯一+非空，聚簇）
    ├── 唯一索引（唯一，允许空）
    └── 普通索引（可重复）
```

---

## 创建索引

创建索引有四种方式，适用场景不同。

### 方式一：CREATE TABLE 时创建

```sql
CREATE TABLE employees (
    id INT PRIMARY KEY,                          -- 主键索引（聚簇）
    name VARCHAR(50) NOT NULL,
    email VARCHAR(100),
    department_id INT,
    salary DECIMAL(10,2),
    
    -- 普通单列索引
    INDEX idx_name (name),
    
    -- 唯一索引
    UNIQUE INDEX uk_email (email),
    
    -- 联合索引（推荐写法）
    INDEX idx_dept_salary (department_id, salary),
    
    -- 前缀索引（长字符串的前 N 个字符）
    INDEX idx_email_pre (email(20))
) ENGINE=InnoDB;
```

### 方式二：ALTER TABLE 添加

```sql
-- 添加普通索引
ALTER TABLE employees ADD INDEX idx_name(name);

-- 添加唯一索引
ALTER TABLE employees ADD UNIQUE INDEX uk_phone(phone);

-- 添加联合索引（注意列顺序）
ALTER TABLE employees ADD INDEX idx_dept_sal(department_id, salary DESC);

-- 添加前缀索引（email 前 20 个字符）
ALTER TABLE employees ADD INDEX idx_email_pre(email(20));
```

### 方式三：CREATE INDEX 单独创建

```sql
-- 普通索引
CREATE INDEX idx_name ON employees(name);

-- 唯一索引
CREATE UNIQUE INDEX uk_email ON employees(email);

-- 联合索引
CREATE INDEX idx_dept_salary ON employees(department_id, salary);

-- 指定索引类型（MyISAM 引擎可指定 BTREE/HASH，InnoDB 只能是 BTREE）
CREATE INDEX idx_name ON employees(name) USING BTREE;
```

### 方式四：降序索引（MySQL 8.0+）

MySQL 8.0 之前，联合索引的所有列默认升序排列。如果需要降序排序，只能在查询时 `ORDER BY col DESC`，让 MySQL 在内存中反向扫描——这个过程很慢。

MySQL 8.0 支持显式创建**降序索引**：

```sql
-- 降序索引：适合高频降序查询
CREATE TABLE orders (
    id INT,
    customer_id INT,
    amount DECIMAL(10,2),
    created_at DATETIME,
    INDEX idx_amount_date (amount DESC, created_at DESC)
) ENGINE=InnoDB;

-- 查询：按金额从高到低、同一天按时间从晚到早
SELECT * FROM orders 
WHERE customer_id = 100
ORDER BY amount DESC, created_at DESC;
--                        ↑           ↑
--               降序索引直接覆盖，无需额外排序
```

> **实战技巧**：如果你经常写 `ORDER BY price DESC, create_time DESC`，创建一个 `(price DESC, create_time DESC)` 的降序索引，MySQL 8.0 会直接利用索引返回有序结果。

---

## 删除索引

```sql
-- 按索引名删除
DROP INDEX idx_name ON employees;

-- 通过 ALTER TABLE 删除
ALTER TABLE employees DROP INDEX idx_name;

-- 删除主键索引（会自动删除聚簇索引）
ALTER TABLE employees DROP PRIMARY KEY;
```

### 注意事项

- 不能删除聚簇索引的主键索引，除非先删除主键约束
- 删除索引会释放磁盘空间，但短期内 space 不会立即归还文件系统（InnoDB 使用 space id 复用）

---

## 查看索引

```sql
-- 查看表的所有索引
SHOW INDEX FROM employees;

-- 格式化输出
SHOW INDEX FROM employees\G
```

输出字段解读：

| 字段 | 含义 |
|-----|------|
| Non_unique | 0=唯一索引，1=普通索引 |
| Key_name | 索引名 |
| Seq_in_index | 联合索引中的列序号（从 1 开始） |
| Column_name | 列名 |
| Collation | 索引中列的排序方式（A=升序，NULL=Hash） |
| Cardinality | 基数（估算的唯一值数量），越接近总行数越好 |
| Sub_part | 前缀索引的长度，NULL 表示全列索引 |
| Packed | 索引压缩方式 |
| Null | 是否允许 NULL |
| Index_type | 索引类型（BTREE/HASH） |

> **Cardinality 优化提示**：如果 Cardinality 很低（如只有 2），说明这个字段区分度差，不适合建索引。可以用 `ANALYZE TABLE` 更新统计信息后再看。

---

## 隐藏索引（Invisible Index）

MySQL 8.0 引入的**隐藏索引**（Invisible Index）是测试索引效果的利器。

### 核心特性

- 索引对优化器不可见（查询不会使用）
- 索引内容仍然维护（写入仍然更新）
- 可以随时设为可见/不可见

### 使用场景

**场景一：测试索引是否真的有用**

```sql
-- 原来的查询使用 idx_dept 索引
SELECT * FROM employees WHERE department_id = 5;

-- 隐藏索引，观察性能变化
ALTER TABLE employees ALTER INDEX idx_dept INVISIBLE;

-- 如果性能变差，说明索引有用，恢复它
ALTER TABLE employees ALTER INDEX idx_dept VISIBLE;
```

**场景二：安全删除索引前先隐藏**

```sql
-- 正常删除索引前，先隐藏验证业务不受影响
ALTER TABLE employees ALTER INDEX idx_old INVISIBLE;
-- 观察一段时间，确认没问题后
DROP INDEX idx_old ON employees;
```

### 语法

```sql
-- 创建时设为隐藏
CREATE INDEX idx_test ON employees(email) INVISIBLE;

-- 切换可见性
ALTER TABLE employees ALTER INDEX idx_test INVISIBLE;
ALTER TABLE employees ALTER INDEX idx_test VISIBLE;

-- 设置优化器参数（控制是否使用隐藏索引）
SET optimizer_switch = 'use_invisible_indexes=on';
```

---

## 重命名索引

MySQL 没有直接的 `RENAME INDEX` 语法，需要重建：

```sql
-- 方式一：先删后建
DROP INDEX idx_old_name ON employees;
CREATE INDEX idx_new_name ON employees(name);

-- 方式二：通过 ALTER TABLE
ALTER TABLE employees DROP INDEX idx_old_name, ADD INDEX idx_new_name(name);
```

---

## 重建索引

索引在长期使用后可能产生碎片（特别是频繁 DELETE 的表），需要重建：

```sql
-- 方式一：OPTIMIZE TABLE（同时重建表和索引）
OPTIMIZE TABLE employees;

-- 方式二：ALTER TABLE 重建
ALTER TABLE employees ENGINE = InnoDB;

-- 方式三：REPAIR TABLE（仅 MyISAM）
REPAIR TABLE employees;
```

> **注意**：对于大表，`OPTIMIZE TABLE` 会锁表并复制全表数据——生产环境谨慎使用，建议在低峰期执行。

---

## 索引统计信息

MySQL 优化器依赖索引统计信息（Cardinality）来选择执行计划。统计信息不准确会导致选错索引。

```sql
-- 更新统计信息（ANALYZE TABLE）
ANALYZE TABLE employees;

-- 查看表统计信息
SHOW TABLE STATUS LIKE 'employees';

-- InnoDB 统计信息配置
SHOW VARIABLES LIKE 'innodb_stats%';
-- innodb_stats_auto_recalc = ON（自动重新计算）
-- innodb_stats_persistent = ON（持久化统计信息）
```

---

## 索引命名规范

好的索引名应该自解释：

```sql
-- ✅ 推荐命名规范
INDEX idx_表名_字段1_字段2 ON 表名(字段1, 字段2)
UNIQUE INDEX uk_表名_字段 ON 表名(字段)

-- 示例
INDEX idx_orders_customer_id ON orders(customer_id)
INDEX idx_orders_cid_status ON orders(customer_id, status)
UNIQUE INDEX uk_user_email ON user(email)

-- ❌ 不推荐：模糊、无法识别用途
INDEX idx_1 ON employees;
INDEX idx_a ON employees;
INDEX idx_index1 ON employees;
```

---

## 小结

索引操作的核心要点：

| 操作 | 语法 | 注意点 |
|-----|------|------|
| 创建 | CREATE INDEX / ALTER TABLE | 选择合适列、列顺序 |
| 删除 | DROP INDEX | 不能删主键索引 |
| 查看 | SHOW INDEX | 关注 Cardinality |
| 隐藏 | ALTER INDEX ... INVISIBLE | 8.0+，测试索引效果 |
| 重建 | OPTIMIZE TABLE | 大表锁表，低峰期使用 |
| 统计 | ANALYZE TABLE | 让优化器选对索引 |

---

## 下一步

知道了索引怎么建，但什么时候该建索引？哪些场景建了反而更慢？

从 [适合/不适合创建索引的场景](/database/mysql/optimize/index/scenario) 继续。
