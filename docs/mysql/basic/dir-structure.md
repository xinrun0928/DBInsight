# MySQL 目录结构

装好了 MySQL，你知道它把数据存在哪了吗？日志在哪？配置文件又在哪？

了解目录结构，不仅是运维需要，日常开发定位问题也会用到。比如：
- 找不到错误日志在哪
- 想备份数据但不知道数据目录
- 磁盘爆了不知道哪个目录占的空间最大

## Windows 目录结构

### 默认安装路径

```
C:\Program Files\MySQL\MySQL Server 8.0\
├── bin\                    # MySQL 可执行文件（mysql.exe, mysqld.exe）
├── lib\                    # 库文件
├── include\                # 头文件（开发用）
├── share\                  # 字符集文件、错误信息模板
├── my.ini                  # 主配置文件（8.0 版本）
└── ...
```

### 默认数据目录

```
C:\ProgramData\MySQL\MySQL Server 8.0\
├── Data\                   # 数据库文件（每个库一个文件夹）
│   ├── mysql\              # mysql 系统库
│   ├── performance_schema\ # performance_schema 库
│   ├── sys\                # sys 库
│   └── your_db\            # 你创建的数据库
├── my.ini                  # 配置文件（实际生效的配置）
├── MySQLError.log          # 错误日志
├── ibdata1                 # InnoDB 系统表空间文件
├── ib_logfile0             # InnoDB 重做日志
└── ib_logfile1             # InnoDB 重做日志
```

> `C:\ProgramData` 是 Windows 的隐藏数据目录，在资源管理器中需要输入路径或开启「显示隐藏文件」才能看到。

### 关键文件说明

| 文件 / 目录 | 作用 |
|-----------|------|
| `Data/` | 所有数据库文件 |
| `my.ini` | 主配置文件 |
| `MySQLError.log` | 错误日志，排查问题的第一手资料 |
| `ibdata1` | InnoDB 系统表空间，所有 InnoDB 表共享 |
| `ib_logfile0 / ib_logfile1` | InnoDB 重做日志（redo log） |
| `auto.cnf` | MySQL 实例唯一 ID（UUID） |

## macOS 目录结构

### Homebrew 安装

```
/usr/local/opt/mysql/
├── bin/
├── lib/
├── my.cnf -> ../Cellar/mysql/8.0.xx/my.cnf
└── ...

/usr/local/var/mysql/          # 数据目录
├── your_db/
│   ├── *.ibd                   # InnoDB 表数据文件
│   └── db.opt                  # 库配置（字符集等）
├── ibdata1                     # 系统表空间
├── ib_logfile0 / ib_logfile1  # redo log
└── *.err                       # 错误日志
```

### DMG 安装

```
/usr/local/mysql/
├── bin/                        # 可执行文件
├── my.cnf                      # 配置文件
├── lib/                        # 库文件
└── ...

/usr/local/mysql/data/          # 数据目录
```

### 配置文件位置

macOS 上配置文件可能存在于多个位置，MySQL 按以下顺序加载：

```
/etc/my.cnf          → 优先级最高
/etc/mysql/my.cnf
/usr/local/mysql/my.cnf
~/.my.cnf
```

查看 MySQL 实际加载了哪个配置：

```sql
SHOW VARIABLES LIKE 'perf_format_file%';
-- 或
mysql --verbose --help | grep -A 5 'Default options'
```

## Linux 目录结构

### rpm / yum 安装

```
/usr/share/mysql/               # 字符集文件、错误信息模板
/usr/bin/                       # 客户端工具和服务器程序
/usr/libexec/                   # mysqld 服务程序
/var/lib/mysql/                 # 数据目录
/etc/my.cnf                     # 主配置文件
/var/log/mysqld.log             # 错误日志
```

### apt 安装

```
/etc/mysql/                     # 配置目录
├── mysql.conf.d/
│   └── mysqld.cnf              # MySQL 配置文件
├── conf.d/                     # 自定义配置片段
└── mysql.conf.d/mysqld.cnf    # 服务器配置

/var/lib/mysql/                 # 数据目录
/var/log/mysql/                 # 日志目录
```

## 数据目录下文件详解

### InnoDB 引擎表（8.0 默认）

```
your_db/
├── db.opt                      # 数据库默认字符集和比较规则
├── t1.ibd                      # 表空间文件（每表一个独立表空间，8.0 默认）
├── t2.ibd
├── ...
```

8.0 中，InnoDB 表默认使用**独立表空间**（`innodb_file_per_table=ON`），每个表一个 `.ibd` 文件。

### MyISAM 引擎表（旧版默认）

```
your_db/
├── t1.MYD                      # MyISAM 数据文件
├── t1.MYI                      # MyISAM 索引文件
├── t1.frm                      # 表结构定义（5.7 中有，8.0 中已移除）
└── ...
```

### 系统库（mysql）

MySQL 自带的 `mysql` 库，存储用户账号、权限等信息：

```
mysql/
├── user.MYD                    # 用户表数据
├── user.MYI                    # 用户表索引
├── db.MYD                      # 库权限表
├── tables_priv.MYD             # 表权限表
└── ...
```

> 8.0 中这些文件变成了 InnoDB 存储在 `mysql.ibd` 中。

## 各个日志文件的作用

```
/var/log/mysql/
├── error.log                   # 错误日志（最常看）
├── general.log                 # 通用查询日志（记录所有 SQL，生产环境别开）
├── slow.log                    # 慢查询日志
└── binlog.000001               # 二进制日志（主从复制、数据恢复）
```

### 查看日志文件位置

```sql
SHOW VARIABLES LIKE '%log%';
```

常用日志变量：

```sql
-- 错误日志路径
SHOW VARIABLES LIKE 'log_error';

-- 慢查询日志路径
SHOW VARIABLES LIKE 'slow_query_log_file';

-- 二进制日志路径
SHOW VARIABLES LIKE 'log_bin';

-- 是否开启慢查询
SHOW VARIABLES LIKE 'slow_query_log';
SHOW VARIABLES LIKE 'long_query_time';  -- 超过多少秒记录
```

## 快速查看 MySQL 关键路径

```sql
-- 数据目录
SHOW VARIABLES LIKE 'datadir';

-- 配置文件
SHOW VARIABLES LIKE 'cnf';

-- 临时文件目录
SHOW VARIABLES LIKE 'tmpdir';

-- 临时表空间
SHOW VARIABLES LIKE 'innodb_temp_data_file_path';
```

## 磁盘空间爆了怎么查

```bash
# Linux/macOS：查看数据目录大小
du -sh /var/lib/mysql

# 查看每个数据库的大小
SELECT
    table_schema AS 'Database',
    ROUND(SUM(data_length + index_length) / 1024 / 1024, 2) AS 'Size (MB)'
FROM information_schema.tables
GROUP BY table_schema
ORDER BY Size (MB) DESC;
```

## 目录配置示例

在 `my.cnf` 中自定义路径：

```ini
[mysqld]
# 数据目录
datadir=/data/mysql

# 独立表空间目录（8.0 推荐）
innodb_directories=/data/mysql/tablespaces

# 临时目录
tmpdir=/tmp

# 日志目录
log_error=/var/log/mysql/error.log
slow_query_log_file=/var/log/mysql/slow.log
log_bin=/var/log/mysql/binlog

# InnoDB 相关
innodb_data_file_path=ibdata1:12M:autoextend
innodb_log_group_home_dir=/var/log/mysql
```

## 下一步

了解了目录结构，下一章来学习 [Linux 环境安装 MySQL（8.0/5.7）](/database/mysql/basic/install/linux)，或者直接开始学习 [SQL 核心语法](/database/mysql/sql/basic/overview)。
