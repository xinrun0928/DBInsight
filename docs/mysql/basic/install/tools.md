# Navicat / SQLyog / DBeaver 工具使用

## 为什么需要图形化客户端

命令行能搞定一切，但图形化工具能让日常开发效率提升 10 倍：

- 不用记 SQL 语法也能查看 / 修改数据
- 表结构一目了然，不用 `DESC table_name`
- 快速执行 SQL 脚本，导出数据到 Excel
- 批量操作，定时任务

三个工具各有特点，选一个最顺手的。

## Navicat Premium（推荐）

### 下载与安装

官网：[https://www.navicat.com/en/products/navicat-premium](https://www.navicat.com/en/products/navicat-premium)

提供 14 天免费试用。Windows / macOS / Linux 都能装。

### 连接 MySQL

1. 点击左上角「**连接**」→「**MySQL**」
2. 填写连接信息：

| 字段 | 说明 | 示例 |
|-----|------|------|
| 连接名 | 随便起，方便识别 | `本地 MySQL 8.0` |
| 主机 | 数据库服务器地址 | `localhost` 或 `127.0.0.1` |
| 端口 | MySQL 端口 | `3306`（默认） |
| 用户名 | MySQL 用户名 | `root` |
| 密码 | MySQL 密码 | `xxxxx` |

3. 点击「测试连接」，成功后再点确定

### 常用功能

#### 查询数据

1. 双击连接 → 双击数据库 → 右键表 → 「打开表」或「设计表」
2. 或者点击左上角「查询」→「新建查询」，写 SQL：

```sql
SELECT * FROM user WHERE status = 1 LIMIT 10;
```

#### 导入 / 导出数据

- **导入**：右键表 → 「导入向导」，支持 Excel、CSV、JSON、XML 等格式
- **导出**：右键表 → 「导出向导」，可导出 Excel、SQL 文件等

#### 数据同步

Tools → 「数据同步」，选择源和目标，一键同步表结构或数据。

#### 模型功能（ER 图）

Tools → 「逆向数据库」，选择表，自动生成 ER 图。

### Navicat 快捷键

| 快捷键 | 功能 |
|-------|------|
| `Ctrl + Q` | 新建查询 |
| `Ctrl + R` | 执行选中的 SQL |
| `Ctrl + Shift + R` | 执行全部 SQL |
| `Ctrl + D` | 快速查看表结构 |
| `Ctrl + L` | 删除当前行 |
| `Ctrl + ,` | 偏好设置 |

## SQLyog（轻量级，推荐 Windows）

### 下载与安装

官网：[https://www.webyog.com/product/sqlyog](https://www.webyog.com/product/sqlyog)

社区版免费，需要注册账号下载。Windows 专属。

### 连接 MySQL

1. 点击「新建」→ 填写连接信息（同 Navicat）
2. 保存并连接

### 常用功能

#### 数据库 / 表管理

左侧树形结构展示所有数据库和表。右键数据库：
- 新建数据库
- 刷新
- 备份 / 恢复

右键表：
- 打开表（查看数据）
- 刷新表
- 优化表 / 检查表
- 导出结果集

#### SQL 执行器

写 SQL 后：
- `F5`：执行全部
- `F9`：执行选中部分
- `Ctrl + Shift + R`：执行并格式化

#### 快速架构同步

右键数据库 → 「同步架构」，自动对比两个数据库的差异，生成 ALTER 语句。

### 快捷键

| 快捷键 | 功能 |
|-------|------|
| `F5` | 执行 SQL |
| `F8` | 格式化 SQL |
| `Ctrl + Shift + T` | 创建表 |
| `Ctrl + 1/2/3` | 切换结果集格式 |

## DBeaver（免费跨平台）

### 下载与安装

官网：[https://dbeaver.io/download/](https://dbeaver.io/download/)

社区版免费，基于 Eclipse，支持 Windows / macOS / Linux。

### 连接 MySQL

1. 点击「数据库」→「新建连接」
2. 选择 MySQL
3. 填写主机、端口、数据库、用户名、密码
4. 点击测试连接

### 常用功能

#### ER 图

右键表 → 「查看关系图」→ 自动生成当前表的关联关系图。

#### 数据导出

右键结果集 → 「导出数据」，支持 CSV、JSON、SQL INSERT、Excel 等格式。

#### SQL 编辑器

强大的 SQL 编辑器，支持代码补全、格式化、执行历史。

#### 导入数据

右键表 → 「导入数据」，支持批量导入大文件。

### 插件生态

DBeaver 支持大量插件：
- 数据可视化（图表）
- 数据库比较
- 数据迁移
- MongoDB、Redis、PostgreSQL 等多数据库支持

### 快捷键

| 快捷键 | 功能 |
|-------|------|
| `Ctrl + Enter` | 执行 SQL |
| `Ctrl + Shift + F` | 格式化 SQL |
| `Ctrl + /` | 注释 / 取消注释 |
| `Ctrl + Space` | 代码补全 |

## 三个工具对比

| 特性 | Navicat | SQLyog | DBeaver |
|------|---------|--------|---------|
| 费用 | 付费（贵） | 社区版免费 | 免费 |
| 平台 | 全平台 | 仅 Windows | 全平台 |
| 界面 | 现代化 | 老派 | Eclipse 风 |
| 性能 | 轻量快速 | 轻量快速 | 较重（功能多） |
| ER 图 | ✅ | ✅ | ✅ |
| 数据同步 | ✅ | ✅（付费版） | ✅ |
| SQL 格式化 | ✅ | ✅ | ✅ |
| 适合人群 | 愿意付费的专业 DBA | Windows 用户 | 跨平台 / 开源党 |

## 数据库连接字符串（代码中用）

安装完工具之后，你的数据库连接信息：

```yaml
# MySQL 8.0
host: localhost
port: 3306
database: school_db
username: root
password: your_password

# JDBC URL
jdbc:mysql://localhost:3306/school_db?useUnicode=true&characterEncoding=utf8mb4&useSSL=false&serverTimezone=Asia/Shanghai
```

## 下一步

客户端装好了，接下来了解 [MySQL 目录结构](/database/mysql/basic/dir-structure)，搞清楚 MySQL 装好之后，各个文件都在哪里。
