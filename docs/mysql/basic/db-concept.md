# 数据库核心概念

## 为什么需要数据库

你可能会想：我用 Excel 也能存数据，用 JSON 文件也能存数据，为什么非要搞一个数据库？

来看一个例子。

### 没有数据库的世界

假设你在做一个「学生成绩管理系统」：

```
# students.json
[
  {"id": 1, "name": "张三", "score": 92},
  {"id": 2, "name": "李四", "score": 88}
]
```

文件存着，看起来没问题。但当数据量上来：

- 查「数学成绩大于 90 分的学生」——你得用代码读整个文件、遍历、判断
- 100 个人同时查——文件被锁住，有人读不到
- 改了王五的成绩，保存的时候赵六刚好也在改——最后保存的人覆盖了另一个人的改动
- 要查「平均分」「不及格人数」「排名」——自己写代码算

文件能存数据，但它不解决：**查询、并发、安全、一致性** 这些问题。

数据库，就是专门解决这些问题的系统。

## DBMS 是什么

**DBMS（Database Management System）** —— 数据库管理系统，是操作数据库的软件。

你不用直接读写磁盘文件，而是通过 DBMS 提供的接口（SQL）来操作数据。DBMS 帮你搞定：

- 数据存在哪、怎么存
- 并发请求怎么处理
- 查询怎么快速返回
- 谁能访问什么数据

MySQL、Oracle、PostgreSQL、SQL Server 都是 DBMS。

## 常用 DBMS 对比

| DBMS | 类型 | 代表用户 | 特点 |
|------|------|---------|------|
| MySQL | 关系型 | 互联网公司 | 免费、轻量、社区活跃 |
| PostgreSQL | 关系型 | 互联网 + 传统企业 | 功能强大、扩展性好 |
| Oracle | 关系型 | 金融、大型企业 | 贵、稳定、功能最全 |
| SQL Server | 关系型 | 微软生态企业 | Windows 集成度高 |
| Redis | 键值型 | 所有公司 | 内存数据库，高速缓存 |
| MongoDB | 文档型 | 互联网公司 | 无 schema，灵活性高 |

对于大多数 Web 应用，MySQL 是最务实的选择——够用、免费、生态成熟。

## 关系型数据库核心概念

**RDBMS（Relational Database Management System）** 是关系型数据库管理系统。它的核心思想是：**用表（Table）来组织数据，表和表之间可以建立关系（Relation）**。

### 几个关键术语

```sql
-- 学生表
CREATE TABLE student (
    id      INT PRIMARY KEY,     -- 学号，主键，唯一标识
    name    VARCHAR(50),         -- 姓名
    age     INT,                 -- 年龄
    class_id INT                 -- 班级编号，外键
);
```

| 术语 | 解释 | 例子 |
|-----|------|------|
| **数据库（Database）** | 存储数据的容器，一个 DBMS 可以管理多个数据库 | `school_db` |
| **表（Table）** | 数据的二维结构，行=记录，列=字段 | `student` |
| **行（Row）** | 一条记录，代表一个实体 | 张三的整行信息 |
| **列（Column）** | 一个字段，描述实体的某个属性 | `name`、`age` |
| **主键（Primary Key）** | 唯一标识每行，不能为空 | `id` |
| **外键（Foreign Key）** | 建立表与表之间的关联关系 | `class_id` 关联 `class` 表 |

### 举一个例子

一个学校管理系统，可能有以下几张表：

```
student 表：学号、姓名、年龄、班级编号
class 表：班级编号、班级名称、班主任
course 表：课程编号、课程名称、学分
score 表：学号、课程编号、成绩
```

student 和 class 通过 `class_id` 关联，score 表把 student 和 course 关联起来——这就是**关系型**数据库的「关系」。

## SQL 是什么

**SQL（Structured Query Language）** —— 结构化查询语言，是操作 RDBMS 的标准语言。

不管你用的是 MySQL、Oracle 还是 PostgreSQL，SQL 语法大体相通。学会一套，触类旁通。

SQL 的分类：

| 分类 | 缩写 | 作用 | 关键字示例 |
|-----|------|------|-----------|
| 数据定义 | DDL | 定义数据库对象（库/表/索引） | CREATE、DROP、ALTER |
| 数据操作 | DML | 操作数据（增删改查） | INSERT、DELETE、UPDATE、SELECT |
| 数据控制 | DCL | 权限和安全控制 | GRANT、REVOKE |
| 事务控制 | TCL | 事务管理 | COMMIT、ROLLBACK、SAVEPOINT |

## 数据库分类

除了关系型数据库，还有其他类型的数据库：

### 键值数据库（KV Store）
- Redis、Memcached
- 适合缓存、Session 存储、排行榜
- 优点：读写极快
- 缺点：只能按 key 查，不支持复杂查询

### 文档数据库
- MongoDB
- 数据以 JSON 文档形式存储，schema 灵活
- 适合内容管理、日志系统

### 列式数据库
- HBase、Cassandra
- 按列存储，适合海量数据分析
- 适合 OLAP 场景

### 图数据库
- Neo4j
- 擅长处理关系网络（社交网络、知识图谱）

大多数业务系统，关系型数据库（MySQL/PostgreSQL）仍然是首选。

## 下一步

理解了数据库的基本概念，下一章我们来看看**关系型数据库和 ER 模型**——搞清楚数据表之间是怎么关联的，为什么这样设计。
