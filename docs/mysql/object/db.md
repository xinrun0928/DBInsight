# 数据库（创建 / 修改 / 删除）

## 什么是数据库

数据库（Database）是 MySQL 中**最高层级的容器**，用于组织和管理表、视图、存储过程等对象。

每个数据库对应文件系统上的一个目录，目录里存放各种表文件。

## 创建数据库

### 基本语法

```sql
CREATE DATABASE school_db;
```

### 指定字符集和比较规则

```sql
CREATE DATABASE school_db
DEFAULT CHARSET = utf8mb4
DEFAULT COLLATE = utf8mb4_unicode_ci;
```

> **重要**：MySQL 8.0+ 默认字符集已经是 `utf8mb4`，不需要手动指定。但 MySQL 5.7 默认是 `latin1`，必须手动设置。

### IF NOT EXISTS（防止重复创建报错）

```sql
CREATE DATABASE IF NOT EXISTS school_db;
```

如果数据库已存在，不会报错，只是个空操作。

### 快速创建（直接使用，不用检查）

```sql
CREATE DATABASE IF NOT EXISTS school_db CHARACTER SET utf8mb4;
```

## 查看数据库

```sql
-- 显示所有数据库
SHOW DATABASES;

-- 显示数据库创建信息
SHOW CREATE DATABASE school_db;
-- 输出：
-- CREATE DATABASE `school_db` /*!40100 DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci */

-- 显示匹配模式的数据库
SHOW DATABASES LIKE 'school%';
```

## 修改数据库

数据库修改主要是改字符集（改名字很少用）：

```sql
ALTER DATABASE school_db
DEFAULT CHARACTER SET = utf8mb4
DEFAULT COLLATE = utf8mb4_unicode_ci;
```

### 重命名数据库

MySQL 没有直接的 `RENAME DATABASE` 命令。重命名需要用 `mysqldump` 导出再导入：

```sql
-- 1. 导出原数据库
mysqldump -u root -p school_db > school_db.sql

-- 2. 创建新数据库
CREATE DATABASE new_school_db;

-- 3. 导入数据
mysql -u root -p new_school_db < school_db.sql

-- 4. 确认无误后删除旧数据库
DROP DATABASE school_db;
```

## 删除数据库

```sql
DROP DATABASE school_db;
```

**危险操作！** 删除后所有数据、表、视图、存储过程全部消失，且无法恢复。

### IF EXISTS 防止报错

```sql
DROP DATABASE IF EXISTS school_db;
```

如果数据库不存在，不会报错。

## 选择数据库

```sql
USE school_db;
```

切换当前会话的默认数据库，后续操作默认在这个数据库中进行。

## 数据库命名规范

```sql
-- 推荐：小写下划线命名
CREATE DATABASE school_management;
CREATE DATABASE order_system;

-- 不推荐
CREATE DATABASE SchoolManagement;  -- 大写
CREATE DATABASE school.management;  -- 带点
CREATE DATABASE school-management;  -- 带减号
```

## 字符集与比较规则

### 常用字符集

| 字符集 | 说明 | 汉字占用 | Emoji 支持 |
|--------|------|---------|-----------|
| `latin1` | 拉丁1，MySQL 5.7 默认 | ❌ 存不了 | ❌ |
| `gbk` | 中文扩展 | 2 字节 | ❌ |
| `utf8`（MySQL 阉割版） | 最多 3 字节 | ✅ | ❌ |
| `utf8mb4` | 完整 UTF-8 | ✅ | ✅ |

### 常用比较规则

| 规则 | 说明 |
|------|------|
| `utf8mb4_general_ci` | 通用比较，快但不精确（中=中=zhong） |
| `utf8mb4_unicode_ci` | Unicode 标准，精确但稍慢 |
| `utf8mb4_0900_ai_ci` | MySQL 8.0 新增，更好的 Unicode 支持 |

> **推荐**：MySQL 8.0+ 用 `utf8mb4_0900_ai_ci`，MySQL 5.7 用 `utf8mb4_unicode_ci`。

## 实战：建库的标准流程

```sql
-- 1. 检查是否存在，存在则删除（清理环境）
DROP DATABASE IF EXISTS school_db;

-- 2. 创建数据库，指定字符集
CREATE DATABASE school_db
DEFAULT CHARSET = utf8mb4
DEFAULT COLLATE = utf8mb4_unicode_ci;

-- 3. 选择数据库
USE school_db;

-- 4. 在此数据库下创建表（接下来几章的内容）
```

## 下一步

数据库建好了，接下来学习 [数据类型（整型/浮点/日期/字符串/JSON）](/database/mysql/object/data-type)——怎么为每列选择合适的数据类型。
