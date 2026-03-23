# 字符集与比较规则（原理 / 修改）

## 为什么字符集是 MySQL 最常见的坑

你一定见过这种乱码：

```
INSERT INTO user (name) VALUES ('张三');
SELECT * FROM user;
-- 显示：???

或者：
INSERT INTO user (bio) VALUES ('我是一个程序员 🎉');
SELECT * FROM user;
-- emoji 存不进去，报错
```

99% 的乱码问题，都是字符集配置不正确导致的。

## 字符集基础

### 什么是字符集

字符集定义了「文字如何存储」。同一个汉字，在不同字符集里占用的字节数完全不同：

| 字符集 | 汉字「中」占用字节 | 最大长度 | Emoji 支持 |
|--------|-----------------|---------|-----------|
| `latin1` | 1 字节（存不下，报错） | 单字节 | ❌ |
| `gbk` | 2 字节 | 双字节 | ❌ |
| `utf8`（MySQL 老版阉割版） | 3 字节 | 三字节 | ❌ |
| `utf8mb4` | 3~4 字节 | 四字节 | ✅ |

> **MySQL 里的 `utf8` 是一个历史遗留陷阱**——它不是标准 UTF-8（4 字节），而是阉割版（最多 3 字节）。一个 emoji 就存不下。

### MySQL 的字符集层次

MySQL 有四个级别的字符集设置：

```
1. 服务器级别（my.cnf）
2. 数据库级别（CREATE DATABASE）
3. 表级别（CREATE TABLE）
4. 列级别（列定义中）
```

底层未设置的级别，会继承上层的设置。

### 查看当前字符集

```sql
-- 查看所有字符集相关变量
SHOW VARIABLES LIKE 'character%';
SHOW VARIABLES LIKE 'collation%';
```

输出示例：

```
character_set_client     | latin1    ← 客户端发送的 SQL 用什么字符集
character_set_connection| latin1    ← 连接层用什么字符集解析
character_set_database  | latin1    ← 当前数据库的默认字符集
character_set_results    | latin1    ← 返回给客户端的结果用什么字符集
character_set_server     | latin1    ← 服务器默认字符集
character_set_system    | utf8       ← 系统元数据（固定 utf8）
```

正常应该是 `utf8mb4`。

## 比较规则（Collation）

比较规则定义了「字符怎么比较」。

```
utf8mb4_general_ci  → 大小写不敏感（中 = 中 = ZHONG）
utf8mb4_unicode_ci → Unicode 标准比较，精确
utf8mb4_0900_ai_ci → MySQL 8.0 新增，更好的 Unicode 支持
```

| 后缀 | 含义 |
|------|------|
| `_ai` | Accent Insensitive（重音不敏感，例如 a = á） |
| `_as` | Accent Sensitive（重音敏感） |
| `_ci` | Case Insensitive（大小写不敏感） |
| `_cs` | Case Sensitive（大小写敏感） |
| `_bin` | Binary（二进制比较，严格区分） |

```sql
-- _ci：不区分大小写
SELECT 'A' = 'a';  -- 1（TRUE）

-- _bin：区分大小写
SELECT 'A' COLLATE utf8mb4_bin = 'a';  -- 0（FALSE）
```

## 字符集修改

### 永久修改（配置文件）

修改 `my.cnf` 或 `my.ini`：

```ini
[mysqld]
character-set-server=utf8mb4
collation-server=utf8mb4_unicode_ci

[client]
default-character-set=utf8mb4

[mysql]
default-character-set=utf8mb4
```

### 会话级修改（临时生效）

```sql
-- 设置当前会话的字符集
SET NAMES utf8mb4;
-- 等价于同时设置：
-- SET character_set_client = utf8mb4;
-- SET character_set_results = utf8mb4;
-- SET character_set_connection = utf8mb4;
```

### 表和列的字符集

```sql
-- 创建数据库时指定
CREATE DATABASE school_db
DEFAULT CHARSET utf8mb4
DEFAULT COLLATE utf8mb4_unicode_ci;

-- 创建表时指定
CREATE TABLE student (
    ...
) ENGINE=InnoDB
DEFAULT CHARSET=utf8mb4
COLLATE=utf8mb4_unicode_ci;

-- 列级别单独指定
CREATE TABLE demo (
    name VARCHAR(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
    code VARCHAR(20) CHARACTER SET latin1  -- 某些场景需要混合字符集
);
```

### 修改已有表的字符集

```sql
-- 修改表的字符集（不改变列的数据）
ALTER TABLE student CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 只改表的默认字符集，不改列
ALTER TABLE student DEFAULT CHARACTER SET utf8mb4;
```

> `CONVERT TO` 会把所有列的数据转换成新字符集。**执行前请备份数据**。

## 乱码排查流程

遇到乱码，按这个顺序排查：

```
1. SHOW VARIABLES LIKE 'character%' → 当前会话字符集是什么？
     ↓ 不对
2. SET NAMES utf8mb4 → 重置连接字符集
     ↓ 解决了
3. 修改 my.cnf 永久配置
```

### 乱码的常见原因

| 场景 | 根因 | 解决方案 |
|------|------|---------|
| 插入正常，查询乱码 | `character_set_results` 错误 | `SET NAMES utf8mb4` |
| 插入就报错 | `character_set_client` 错误 | `SET NAMES utf8mb4` |
| 旧数据乱码 | 历史上用了错误字符集写入 | 无法恢复，只能重写 |
| emoji 存不进去 | 用了 `utf8` 而非 `utf8mb4` | 改用 `utf8mb4` |

## 字符集与索引

字符集直接影响索引效率：

```sql
-- utf8mb4 下，每个汉字最多 4 字节
-- 如果一列有很长的中文字段做索引，占用空间会很大

-- 可以用前缀索引减少空间
ALTER TABLE student ADD INDEX idx_name (name(10));
-- 只用前 10 个字符建立索引（10 * 4 = 40 字节）
```

## MySQL 8.0 的改进

MySQL 8.0 在字符集方面做了重要改进：

| 改进 | 说明 |
|------|------|
| 默认字符集改为 utf8mb4 | 不再需要手动配置 |
| 默认比较规则改为 utf8mb4_0900_ai_ci | 更精确的 Unicode 排序 |
| 支持 25 种 utf8mb4 排序规则 | 比 utf8mb4_general_ci 更完善 |
| 索引支持 3072 字节限制 | utf8mb4 下 varchar(768) |

## 下一步

字符集搞清楚了，接下来看 [SQL 大小写/sql_mode 设置](/database/mysql/advanced/sql-mode)——MySQL 的模式和大小写敏感性配置。
