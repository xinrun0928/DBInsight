# RDBMS vs 非关系型 / ER 模型与表关系

## 关系型 vs 非关系型

这是很多人困惑的第一个岔路口：什么时候用 MySQL，什么时候用 MongoDB / Redis？

### 本质区别

**关系型数据库（RDBMS）** 把数据组织成**表**，表和表之间通过**外键**建立关系。数据是结构化的、强类型的，你得先定义好每列是什么类型才能存数据。

**非关系型数据库（NoSQL / NoSQL + NewSQL）** 则是另一套思路：
- 键值型：只按 key 存取值，没有表的概念
- 文档型：用 JSON 文档存数据，字段可以随时增删
- 列式型：为列设计存储，适合分析场景
- 图数据库：用节点和边表达关系网络

### 怎么选

| 场景 | 推荐 |
|------|------|
| 用户订单、商品、交易系统 | MySQL / PostgreSQL |
| 缓存、Session、排行榜 | Redis |
| 社交 Feed、日志、聊天记录 | MongoDB |
| 大数据分析、报表 | ClickHouse / HBase |
| 关系网络（好友关系、推荐系统） | 图数据库 |

现实中大多数系统是**组合使用**：MySQL 存核心业务数据，Redis 做缓存，MongoDB 存日志——各司其职。

> 记住：没有银弹。MySQL 不是万能的，但也不要把 MySQL 当万能的。

## ER 模型：数据表设计的起点

做数据库表结构设计之前，先画 ER 图（Entity-Relationship Diagram）。

### 三个核心概念

**实体（Entity）**：一个独立的对象，可以是一个人、一个订单、一门课程。在 ER 图里用矩形表示。

**属性（Attribute）**：实体的特征。比如学生有学号、姓名、年龄。在 ER 图里用椭圆表示（画图时通常简化成列名）。

**关系（Relationship）**：实体之间的联系。比如「学生」和「班级」之间是「属于」关系，「学生」和「课程」之间是「选修」关系。在 ER 图里用菱形表示。

### 常见的 ER 关系类型

```
一对一（1:1）：公民 -- 身份证
一对多（1:N）：班级 -- 学生
多对多（M:N）：学生 -- 课程
```

多对多关系怎么存？答案：**中间表**。

```
student(id, name, age)
course(id, name, credit)
student_course(student_id, course_id, score)  ← 中间表，拆成两个 1:N
```

### ER 图到表的转换规则

```
每个实体 → 一张表
实体的属性 → 表的列
主键 → PRIMARY KEY
关系 → 分情况处理：
  - 1:1：任选一张表，加另一张表的主键
  - 1:N：在 N 端表，加 1 端的主键作为外键
  - M:N：新建一张中间表，两个外键分别指向两张主表
```

## 表关系实战

以一个完整的电商系统为例：

### 需求分析

系统需要管理：用户、商品、分类、订单、订单明细。

### ER 关系梳理

```
用户（User）：一个用户可以有多个订单
商品（Product）：一个商品可以出现在多个订单明细中
分类（Category）：一个分类下有多个商品
订单（Order）：一个订单属于一个用户，一个订单有多个明细
订单明细（OrderItem）：一个明细对应一个商品和一个订单
```

### 转换为表结构

```sql
-- 用户表（1 端）
CREATE TABLE user (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    username VARCHAR(50) NOT NULL,
    phone VARCHAR(20),
    created_at DATETIME
);

-- 分类表（1 端）
CREATE TABLE category (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL,
    parent_id INT DEFAULT NULL
);

-- 商品表（N 端，外键指向分类）
CREATE TABLE product (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(200) NOT NULL,
    price DECIMAL(10,2),
    category_id INT,
    FOREIGN KEY (category_id) REFERENCES category(id)
);

-- 订单表（N 端，外键指向用户）
CREATE TABLE `order` (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id BIGINT NOT NULL,
    total_amount DECIMAL(10,2),
    status TINYINT,
    created_at DATETIME,
    FOREIGN KEY (user_id) REFERENCES user(id)
);

-- 订单明细表（关联表，同时持有 order_id 和 product_id）
CREATE TABLE order_item (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    order_id BIGINT NOT NULL,
    product_id BIGINT NOT NULL,
    quantity INT,
    price DECIMAL(10,2),
    FOREIGN KEY (order_id) REFERENCES `order`(id),
    FOREIGN KEY (product_id) REFERENCES product(id)
);
```

### 表关系图示

```
user (1) ──── (N) order (1) ──── (N) order_item (N) ──── (1) product (N) ──── (1) category
```

## 非关系型数据模型简介

MongoDB 的文档模型不需要事先定义 schema，同一个集合里可以有不同的文档结构：

```javascript
// 文档 A
{ "_id": 1, "name": "张三", "age": 22 }

// 文档 B（同集合，但字段不同）
{ "_id": 2, "name": "李四", "tags": ["Java", "MySQL"] }
```

这种灵活性在快速迭代时很有用，但代价是**数据一致性要自己保证**，没有了约束（外键、NOT NULL）带来的自动校验。

## 下一步

理解了数据模型之后，下一步就是**动手建表**——先了解 MySQL 的安装和环境配置。
