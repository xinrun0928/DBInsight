# 主键设计、范式与反范式

很多性能问题，表面上是 SQL 写得不好，深层原因是**表结构设计就不对**。主键选错了，联合查询多一次回表；表结构太范式化，JOIN 满天飞；太反范式，数据一致性噩梦。

这一节从数据库设计的角度，聊聊怎么从源头避免性能问题。

---

## 主键设计：MySQL 性能的地基

InnoDB 表的数据以主键为排序依据存储在 B+ 树中。主键的选择，直接影响：
- 聚簇索引的物理存储顺序
- 写入性能（页分裂）
- 索引体积

### 方案一：自增主键（推荐）

```sql
CREATE TABLE orders (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    ...
) ENGINE=InnoDB;
```

**优点**：

| 优点 | 说明 |
|-----|------|
| 插入有序 | 新行追加到末尾，无页分裂 |
| 主键单调递增 | B+ 树稳定，无频繁节点分裂 |
| 索引体积小 | BIGINT(8字节) vs UUID(36字符) |
| 查询快 | ID 是等值查询最好的条件 |

**缺点**：

- 分布式场景下无法生成全局唯一 ID（需要依赖分布式 ID 生成器）
- ID 不可读，URL 中暴露不安全

### 方案二：UUID 主键（不推荐）

```sql
CREATE TABLE orders (
    id CHAR(36) PRIMARY KEY,   -- UUID 长度
    ...
) ENGINE=InnoDB;

-- 写入 UUID
INSERT INTO orders VALUES (UUID(), ...);
```

**灾难性后果**：

```
插入 UUID = 'a3f8c2e1-...'
实际 B+ 树插入位置：第 150000 页（随机位置）

插入过程：
1. 查找 UUID 在 B+ 树中的位置
2. 该页已满 → 页分裂
3. 重新分配页面
4. 写入数据
5. 更新父节点指针

结果：每次插入都可能触发页分裂
     索引体积膨胀 3~5 倍
     写入性能下降 10 倍以上
```

**为什么 UUID 是灾难**：

- UUID 是无序的（即使使用 v7 也只是趋势有序）
- 每次插入都是随机 I/O
- 聚簇索引无序导致大量页分裂
- 36 字符 vs 8 字节，索引体积膨胀 4.5 倍

### 方案三：分布式 ID（推荐用于分布式场景）

```sql
-- 方案 A：雪花算法（Snowflake）
-- 分布式应用推荐，每个节点生成唯一自增 ID
-- 时间戳(41位) + 机器ID(10位) + 序列号(12位) = 64位整数

-- 方案 B：MySQL 批量 ID 生成
-- 单独建一张 ID 生成表，用 REPLACE INTO 原子获取
CREATE TABLE id_generator (
    id_name VARCHAR(50) PRIMARY KEY,
    id_value BIGINT NOT NULL
);

-- 获取新 ID（每次 +1000）
REPLACE INTO id_generator (id_name, id_value) 
VALUES ('order_id', LAST_INSERT_ID(id_value + 1000));

SELECT LAST_INSERT_ID();  -- 获取当前批次起始值
```

### 主键设计决策树

```
是否分布式架构？
├── 否 → 自增 BIGINT 主键 ✅
└── 是
    ├── 单 MySQL 实例 → 自增主键
    └── 多 MySQL 实例 → 雪花算法 / 批量 ID 生成器
```

---

## 数据库规范化（范式）

数据库规范化通过消除冗余来减少存储空间和提高数据一致性。

### 三大范式

#### 第一范式（1NF）：字段原子性

```
❌ 违反 1NF：
address: "北京市朝阳区望京街道123号A栋1201室"

✅ 符合 1NF：
province: "北京"
city: "北京"
district: "朝阳区"
street: "望京街道123号"
building: "A栋1201室"
```

#### 第二范式（2NF）：消除部分依赖

```
❌ 违反 2NF（订单表）：
order_id | product_id | product_name | quantity
1        | 100        | iPhone 15   | 2
-- product_name 只依赖 product_id，和 order_id 无关

✅ 符合 2NF：
-- 订单表：
order_id | product_id | quantity
1        | 100        | 2

-- 商品表：
product_id | product_name
100        | iPhone 15
```

#### 第三范式（3NF）：消除传递依赖

```
❌ 违反 3NF（学生表）：
student_id | name | class_id | class_name | teacher
1          | Tom  | C01      | 三年一班   | 王老师
-- class_name 和 teacher 都依赖 class_id（传递自 student_id）

✅ 符合 3NF：
-- 学生表：
student_id | name | class_id
1          | Tom  | C01

-- 班级表：
class_id | class_name | teacher
C01      | 三年一班   | 王老师
```

### 规范化的优点

| 优点 | 说明 |
|-----|------|
| 减少数据冗余 | 同一信息只存储一次 |
| 数据一致性 | 修改一处即可更新所有相关数据 |
| 存储空间小 | 无重复数据 |
| 结构清晰 | 每个表职责单一 |

### 规范化的缺点

```
高度规范化的表 → 更多 JOIN → 更多 I/O → 更慢的查询
```

---

## 反范式设计

反范式是故意在表中保存冗余数据，以减少 JOIN，提高读取性能。

### 场景：订单列表需要显示用户名

```
高度规范化：
orders (id, user_id, amount) 
    JOIN users (id, name) → 显示用户名
    JOIN products (id, name) → 显示商品名称
    JOIN addresses (id, detail) → 显示收货地址

一个订单列表页面 → 4~5 个 JOIN
```

```
反范式化：
orders (id, user_id, user_name, product_id, product_name, amount)
-- user_name 和 product_name 直接冗余存储，不需要 JOIN

订单列表 → 0 个 JOIN，0 次回表 → 极致读取性能
```

### 反范式化的代价

| 代价 | 说明 |
|-----|------|
| 数据一致性风险 | 修改用户名时需要同时更新 orders 表 |
| 存储空间增加 | 冗余字段占用更多磁盘 |
| 更新复杂度 | 多表关联修改时容易出错 |

### 反范式化实现方案

#### 方案一：应用层同步冗余

```sql
-- 订单表冗余用户名
ALTER TABLE orders ADD COLUMN user_name VARCHAR(50);

-- 下单时应用层同步写入
BEGIN;
INSERT INTO orders (user_id, user_name, amount) VALUES (?, ?, ?);
COMMIT;
-- 应用层更新：
UPDATE orders SET user_name = ? WHERE user_id = ?;
```

#### 方案二：触发器同步（不推荐，维护复杂）

```sql
-- 创建触发器自动同步
DELIMITER $$
CREATE TRIGGER trg_users_update
AFTER UPDATE ON users
FOR EACH ROW
BEGIN
    UPDATE orders SET user_name = NEW.name WHERE user_id = NEW.id;
END$$
DELIMITER ;
```

#### 方案三：定时任务同步（适合读多写少）

```sql
-- 每天凌晨同步一次用户名
UPDATE orders o
JOIN users u ON o.user_id = u.id
SET o.user_name = u.name
WHERE o.user_name != u.name 
   OR o.user_name IS NULL;
```

---

## 范式与反范式的平衡

没有绝对的"范式好"或"反范式好"。根据业务场景选择：

### 判断标准

| 因素 | 倾向规范化 | 倾向反范式 |
|-----|---------|---------|
| 读取频率 | 偶尔读取 | 频繁读取（> 100 QPS） |
| 更新频率 | 频繁更新 | 很少更新 |
| 数据一致性要求 | 高（金融、库存） | 中等 |
| JOIN 表的数量 | 2~3 个 | 5 个以上 |
| 团队技术能力 | 高（能维护好一致性） | 一般 |

### 实际项目中的策略

```
基础规范：至少达到 3NF（大多数 OLTP 系统）

读性能优化：
├── 数据量 < 1000 万 → 适当反范式化
├── 数据量 > 1000 万 → 优先索引优化，再考虑反范式
└── 数据量 > 1 亿 → 考虑分库分表 / 读写分离

写入性能优化：
├── 批量写入 → 用 LOAD DATA INFILE
├── 实时写入 → 确保主键自增，避免页分裂
└── 异步写入 → 消息队列削峰，批量处理
```

---

## 常见设计问题与优化

### 问题一：外键过多

```sql
-- ❌ 一张表有 10+ 个外键
CREATE TABLE orders (
    user_id FK,
    product_id FK,
    address_id FK,
    warehouse_id FK,
    payment_id FK,
    ...
);

-- ✅ 拆分或合并
-- 合理的外键数：<= 5 个
-- 超过 5 个考虑：功能拆分、或适当冗余
```

### 问题二：超宽表

```sql
-- ❌ 字段超过 50 个
CREATE TABLE config (
    id INT PRIMARY KEY,
    -- 50+ 配置字段...
);
-- 大量 NULL 字段，浪费空间

-- ✅ 垂直拆分
CREATE TABLE config_base (...);     -- 常用字段
CREATE TABLE config_extra (...);    -- 扩展字段
```

### 问题三：时间字段设计

```sql
-- ❌ 用 INT 存储时间戳
created_at INT UNSIGNED   -- 不直观，范围受限

-- ❌ 用 VARCHAR 存储日期
created_at VARCHAR(20)    -- 无法做日期范围查询

-- ✅ 用 DATETIME / TIMESTAMP
created_at DATETIME DEFAULT CURRENT_TIMESTAMP
updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
-- DATETIME：适合存储精确时间
-- TIMESTAMP：自动时区转换，存储空间小 4 字节
```

---

## 小结

主键设计是 MySQL 性能的地基：

| 主键类型 | 适用场景 | 性能 |
|--------|--------|-----|
| 自增 BIGINT | 单实例 OLTP | 极佳 |
| 雪花算法 | 分布式架构 | 极佳 |
| UUID CHAR | 不推荐 | 灾难 |

范式与反范式的选择：

- **OLTP 系统**：先 3NF，再用索引优化，最后考虑反范式
- **OLAP 系统**：可以更激进地反范式化
- **高并发读取场景**：反范式化 + 覆盖索引是性能优化的大招

> 记住：**好的表结构设计是性能优化的起点**。设计阶段多花 1 小时，线上可能节省 100 小时的调优时间。

---

## 下一步

单表优化已经做到极致，但数据量持续增长怎么办？硬件配置、参数调优、大表优化还有哪些手段？

从 [数据库调优：硬件、参数、大表](/database/mysql/optimize/overall-tuning) 继续。
