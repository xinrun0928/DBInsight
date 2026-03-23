# MySQL 逻辑架构 / SQL 执行流程

## MySQL 架构概览

MySQL 的逻辑架构分为三层：

```
┌─────────────────────────────────────────────┐
│            连接层（Connection Pool）            │
│  连接管理 │ 线程管理 │ 认证 │ SSL            │
└────────────────┬────────────────────────────┘
                 │
┌────────────────▼────────────────────────────┐
│           服务层（SQL Layer）                 │
│  ┌──────────┐ ┌──────────┐ ┌─────────────┐ │
│  │ 解析器   │ │ 优化器   │ │ 执行器      │ │
│  │ Parser  │ │ Optimizer│ │ Executor   │ │
│  └──────────┘ └──────────┘ └─────────────┘ │
│  ┌──────────────────────────────────────┐ │
│  │  查询缓存（MySQL 8.0 已移除）          │ │
│  └──────────────────────────────────────┘ │
└────────────────┬────────────────────────────┘
                 │
┌────────────────▼────────────────────────────┐
│           存储引擎层（Storage Engines）       │
│     InnoDB  │  MyISAM  │  Memory  │ ...     │
└─────────────────────────────────────────────┘
```

## 第一层：连接层

负责管理客户端连接。

### 连接管理

```sql
-- 查看当前连接数
SHOW STATUS LIKE 'Threads_connected';
SHOW STATUS LIKE 'Max_used_connections';

-- 查看配置的最大连接数
SHOW VARIABLES LIKE 'max_connections';

-- 查看当前连接列表
SHOW PROCESSLIST;
SHOW FULL PROCESSLIST;
```

### 连接参数

```ini
[mysqld]
max_connections = 500           -- 最大连接数
wait_timeout = 28800            -- 空闲超时（秒）
interactive_timeout = 28800     -- 交互式连接超时
thread_cache_size = 50          -- 线程缓存大小
```

### 连接方式

```sql
-- TCP/IP 连接（常用）
mysql -h 192.168.1.100 -P 3306 -u root -p

-- Unix Socket 连接（仅本地，性能更好）
mysql -u root -p -S /tmp/mysql.sock

-- Windows 命名管道（仅本地）
mysql -u root -p --pipe
```

## 第二层：服务层（核心）

### SQL 解析器（Parser）

把 SQL 语句解析成「解析树」：

```sql
SELECT name FROM student WHERE score > 80
           ↓
      ┌──────────────┐
      │ SELECT 列: name │
      │ FROM 表: student │
      │ WHERE: score > 80 │
      └──────────────┘
```

### 查询优化器（Optimizer）

优化器决定「怎么执行最快」：

```sql
-- 同样结果，不同执行计划，性能可能差 100 倍
SELECT * FROM student
WHERE score > 80 AND class_id = 1;

-- 优化器可能选择：
-- 方案A：先过滤 class_id=1，再用 score>80 过滤
-- 方案B：先过滤 score>80，再用 class_id=1 过滤
-- 方案C：直接扫描全表
```

> 优化器的选择不一定最优，但通常足够好。你可以用 `EXPLAIN` 查看优化器的决策。

### 执行器（Executor）

按优化器的计划，调用存储引擎执行：

```sql
-- 实际执行流程（伪代码）
1. 调用 InnoDB 接口读取 student 表的第一行
2. 检查 WHERE 条件：score > 80 AND class_id = 1
3. 如果满足，存入结果集
4. 重复 1~3，直到读完所有行
5. 返回结果集给客户端
```

### MySQL 8.0 之前的查询缓存（已移除）

> MySQL 8.0 **移除了查询缓存**，因为它在高并发场景下反而成为性能瓶颈。相同的 SQL 在高并发下，缓存命中率极低，而且每次写操作都要清空相关缓存，反而增加了开销。

## 第三层：存储引擎层

存储引擎负责实际读写磁盘数据。

### InnoDB vs MyISAM

| 特性 | InnoDB | MyISAM |
|------|--------|--------|
| 事务支持 | ✅ ACID | ❌ 不支持 |
| 行锁 | ✅ 支持 | ❌ 只有表锁 |
| 外键 | ✅ 支持 | ❌ 不支持 |
| MVCC | ✅ 支持 | ❌ 不支持 |
| 全文索引 | ✅（5.6+） | ✅ 原生支持 |
| 地理空间 | ✅ | ✅ |
| 主键 | 要求 | 可无（数据文件排序） |
| 存储结构 | 聚簇索引 | 非聚簇索引 |
| 适用场景 | OLTP/并发写入 | OLAP/只读场景 |

> **默认使用 InnoDB**，除非有特殊需求。

## SQL 执行流程详解

以一条查询语句为例：

```sql
SELECT name FROM student WHERE class_id = 1 AND score > 80 ORDER BY score DESC LIMIT 10;
```

### 执行步骤

```
1. 连接层
   └─ 验证用户身份，建立连接线程

2. 解析器
   └─ 解析 SQL，生成语法树
   └─ 检查表是否存在、列是否正确

3. 预处理器
   └─ 检查权限
   └─ 展开视图

4. 优化器（关键）
   └─ 选择最优执行计划
   └─ 决定：先过滤 class_id 还是 score？
   └─ 决定：是否使用索引？
   └─ 决定：ORDER BY 用哪个索引？

5. 执行器
   └─ 调用存储引擎接口，逐行读取数据
   └─ 根据 WHERE 条件过滤
   └─ 排序（内存或磁盘）
   └─ 截取前 10 条

6. 结果返回
   └─ 结果集返回给客户端
```

### 各步骤的执行顺序

```
FROM → WHERE → GROUP BY → HAVING → SELECT → ORDER BY → LIMIT
```

## 慢查询的排查思路

当 SQL 执行慢时，按这个思路排查：

```
SQL 慢？
  ↓
EXPLAIN 查看执行计划
  ↓
看 type 列：ALL（全表扫描）？REF/RANGE（走索引）？
  ↓
看 key 列：实际用了哪个索引？没显示索引？
  ↓
看 rows 列：扫描了多少行？100万行还是10行？
  ↓
看 extra 列：Using filesort？Using temporary？
  ↓
优化：加索引 / 重写 SQL / 调整执行顺序
```

> 具体分析方法见 EXPLAIN 章节。

## 下一步

逻辑架构理解了，接下来看 [存储引擎](/database/mysql/advanced/engine/innodb-myisam)——InnoDB 和 MyISAM 的详细对比。
