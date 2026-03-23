# Linux 环境安装 MySQL（8.0 / 5.7）

## 安装方式选择

Linux 上安装 MySQL 有几种方式：

| 方式 | 优点 | 缺点 |
|------|------|------|
| rpm / deb 包 | 安装简单，版本固定 | 升级麻烦 |
| yum / apt 仓库 | 支持 yum/apt update 升级 | 仓库版本可能不是最新版 |
| 二进制压缩包 | 可自定义路径，灵活性高 | 需要手动配置 |
| 源码编译 | 深度定制 | 编译耗时长，不推荐生产环境 |

生产环境推荐 **yum / apt 仓库安装**，兼顾安装便捷和版本管理。

## CentOS / Rocky / RHEL 安装（yum）

### 安装 MySQL 8.0

#### 方式一：MySQL 官方 yum 仓库（推荐）

```bash
# 1. 下载 yum 仓库包（以 CentOS 7 为例）
wget https://dev.mysql.com/get/mysql80-community-release-el7-7.noarch.rpm

# 2. 安装仓库
sudo rpm -Uvh mysql80-community-release-el7-7.noarch.rpm

# 3. 安装 MySQL Server
sudo yum install -y mysql-community-server

# 4. 启动 MySQL
sudo systemctl start mysqld

# 5. 设置开机自启
sudo systemctl enable mysqld

# 6. 查看临时密码
sudo grep 'temporary password' /var/log/mysqld.log
```

#### 方式二：yum 仓库更新版本（如果有旧仓库）

```bash
# 如果之前装过其他版本，先卸载
sudo yum remove mysql-community-server mysql80-community-release

# 重新安装
sudo yum install mysql-community-server
sudo systemctl restart mysqld
```

### 安装 MySQL 5.7

5.7 需要切换仓库子通道：

```bash
# 1. 安装 5.7 仓库
sudo yum install https://dev.mysql.com/get/mysql57-community-release-el7-11.noarch.rpm

# 2. 禁用 8.0 仓库，启用 5.7 仓库
sudo yum-config-manager --disable mysql80-community
sudo yum-config-manager --enable mysql57-community

# 3. 安装
sudo yum install -y mysql-community-server

# 4. 启动
sudo systemctl start mysqld
```

### 初始化并获取临时密码

```bash
# MySQL 8.0 安装后自动初始化
# 查看临时密码
sudo grep 'temporary password' /var/log/mysqld.log

# MySQL 5.7 需要手动初始化（如果数据目录为空）
sudo mysqld --initialize --user=mysql
# 临时密码同样在 /var/log/mysqld.log 中
```

### 安全初始化（设置 root 密码）

```bash
sudo mysql_secure_installation
```

交互式设置：
1. 验证密码插件：选择 `0`（低强度）/ `1`（中）/ `2`（高）
2. 设置 root 密码
3. 移除匿名用户：Y
4. 禁止 root 远程登录：Y（如果需要远程连接选 N）
5. 删除测试数据库：Y
6. 重新加载权限表：Y

### 登录验证

```bash
mysql -u root -p
# 输入密码后看到 mysql> 即成功
```

## Ubuntu / Debian 安装（apt）

### 安装 MySQL 8.0

```bash
# 1. 下载 apt 仓库包
wget https://dev.mysql.com/get/mysql-apt-config_0.8.xx-1_all.deb

# 2. 安装仓库（交互式，选择 MySQL 8.0）
sudo dpkg -i mysql-apt-config_0.8.xx-1_all.deb

# 3. 更新 apt
sudo apt update

# 4. 安装 MySQL
sudo apt install -y mysql-server

# 5. 启动
sudo systemctl start mysql

# 6. 查看状态
sudo systemctl status mysql
```

### 安装 MySQL 5.7

```bash
# 1. 下载 5.7 apt 包
wget https://dev.mysql.com/get/mysql-apt-config_0.8.22-1_all.deb

# 2. 交互式选择 MySQL 5.7
sudo dpkg -i mysql-apt-config_0.8.22-1_all.deb
# 选择 MySQL Server → mysql-5.7 → OK

# 3. 安装
sudo apt update
sudo apt install -y mysql-server-5.7
```

### Ubuntu 20.04+ 注意事项

Ubuntu 20.04+ 自带的 MySQL 是 8.0 版本，但通过 `apt install mysql-server` 安装的是 Snap 包，不太好用。

推荐卸载后用官方仓库重装：

```bash
sudo apt remove --purge mysql-server mysql-client mysql-common
sudo rm -rf /etc/mysql /var/lib/mysql
sudo rm -rf /var/log/mysql

# 然后重新用官方仓库安装
```

## 防火墙与远程访问配置

### CentOS / RHEL（firewalld）

```bash
# 开放 3306 端口
sudo firewall-cmd --zone=public --add-port=3306/tcp --permanent

# 重新加载防火墙
sudo firewall-cmd --reload

# 确认规则生效
sudo firewall-cmd --list-ports
```

### Ubuntu / Debian（ufw）

```bash
# 开放 3306 端口
sudo ufw allow 3306/tcp

# 查看状态
sudo ufw status
```

### 远程连接验证

在另一台机器上测试：

```bash
mysql -h 服务器IP -u root -p
```

如果连接被拒绝，检查：

1. MySQL 用户是否允许远程登录：

```sql
-- 查看 root 用户的 host
SELECT user, host FROM mysql.user WHERE user = 'root';

-- 如果 host 是 'localhost'，添加允许远程的账号
CREATE USER 'root'@'%' IDENTIFIED BY '你的密码';
GRANT ALL PRIVILEGES ON *.* TO 'root'@'%' WITH GRANT OPTION;
FLUSH PRIVILEGES;
```

2. 端口是否开放（`nc -zv IP 3306`）
3. MySQL 是否只监听了 127.0.0.1：

```sql
SHOW VARIABLES LIKE 'bind_address';
-- 如果是 127.0.0.1，在 my.cnf 中改为 0.0.0.0
```

## 安装后性能配置（生产环境必做）

Linux 默认参数是为通用 Linux 优化的，安装 MySQL 后需要调优。

### 关键配置参数

```ini
[mysqld]
# InnoDB 缓冲池大小（建议设为机器内存的 50%~70%）
innodb_buffer_pool_size = 2G

# redo log 文件大小（影响写入性能）
innodb_log_file_size = 256M

# 最大连接数
max_connections = 500

# 表名大小写（Linux 必须统一，0=大小写敏感）
lower_case_table_names = 1

# 禁用 DNS 反向解析（加速连接）
skip-name-resolve
```

### 应用配置后重启

```bash
# CentOS
sudo systemctl restart mysqld

# Ubuntu
sudo systemctl restart mysql
```

## 卸载 MySQL

```bash
# CentOS
sudo yum remove mysql-community-server mysql-community-client mysql-community-libs
sudo rpm -e mysql80-community-release

# Ubuntu
sudo apt remove --purge mysql-server mysql-client mysql-common
sudo rm -rf /etc/mysql /var/lib/mysql
sudo rm -rf /var/log/mysql
```

## 下一步

Linux 上 MySQL 装好了，现在你可以 [Linux 下 MySQL 远程连接（SQLyog）](/database/mysql/basic/install/linux-remote) 配置远程访问，或者直接开始学习 [SQL 核心语法](/database/mysql/sql/basic/overview)。
