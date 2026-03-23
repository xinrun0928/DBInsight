# Redo Log 与 Undo Log

Redo Log 和 Undo Log 是 InnoDB 事务机制的两大支柱——一个是"已做的事要记住"，一个是"做过的事要能撤销"。

---

## Redo Log：事务的"已做事日志"

### 为什么需要 Redo Log

MySQL 的数据最终存在磁盘上，但磁盘 I/O 是最慢的操作。

```
裸写数据页的问题：
1. UPDATE orders SET status = 'paid' WHERE id = 1;
2. 从磁盘读数据页到内存（16KB，1次 I/O）
3. 修改内存中的数据页
4. 刷盘（16KB，1次 I/O）
5. 事务提交完成

问题：如果事务提交后、刷盘前崩溃了，数据丢了！
```

Redo Log 解决了这个问题：**把"修改了什么"先记到顺序写的日志文件，然后后台慢慢刷盘**。

### Redo Log 的工作原理

```
事务提交时（innodb_flush_log_at_trx_commit=1）：
┌────────────┐    ┌────────────┐    ┌────────────┐    ┌────────────┐
│ 修改内存    │ →  │ 写入RedoLog │ →  │ 刷盘RedoLog │ →  │ 后台刷数据页│
│ 数据页     │    │  (顺序写)   │    │  (保证持久)  │    │            │
└────────────┘    └────────────┘    └────────────┘    └────────────┘
```

Redo Log 记录的是**"物理修改"**：

```
Redo Log 示例（简化）：
Page {space=1, page_no=5} offset 128: 
  old_bytes=[41 61 6E]  // "Amy" 的 ASCII
  new_bytes=[41 6C 69]  // "Ali" 的 ASCII
```

### Redo Log 的刷盘策略

```sql
SHOW VARIABLES LIKE 'innodb_flush_log_at_trx_commit';
```

| 参数值 | 行为 | 持久性 | 性能 |
|-------|------|--------|-----|
| 0 | 每秒刷盘一次，事务提交不刷盘 | 最多丢1秒数据 | 最快 |
| 1 | 每次事务提交都刷盘（默认） | 绝不丢数据 | 较慢 |
| 2 | 每次事务提交刷到系统缓存，由系统决定何时刷盘 | 机器宕机可能丢数据 | 较快 |

```
各策略对比：
innodb_flush_log_at_trx_commit=0（最快）：
事务提交 → 写入 Log Buffer → 每秒 fsync → 后台刷盘
风险：崩溃可能丢最近1秒的数据

innodb_flush_log_at_trx_commit=1（最安全）：
事务提交 → 写入 Log Buffer → fsync → 数据保证持久
推荐用于：金融、订单、库存等强一致性场景

innodb_flush_log_at_trx_commit=2（折中）：
事务提交 → 写入 Log Buffer → 刷到系统页缓存 → 后台 fsync
风险：机器断电时（操作系统崩溃），可能丢数据
推荐用于：可以容忍少量数据丢失的场景
```

### Redo Log 的文件结构

```
ib_logfile0（默认 48MB）
ib_logfile1（默认 48MB）
ib_logfile2（可选）

┌────────────────────────────────────────┐
│ Redo Log 文件循环使用                    │
│                                        │
│  ┌────┬───────────────────────┬────┐  │
│  │写入│                       │检查点│  │
│  └────┴───────────────────────┴────┘  │
│  LSN  checkpoint                    LSN │
│  起点                                  │
│                                        │
│  文件写满后循环到开头（覆盖）             │
│  但只有已刷盘的日志才能被覆盖              │
└────────────────────────────────────────┘
```

| 参数 | 默认值 | 说明 |
|-----|-------|------|
| `innodb_log_file_size` | 48MB | 每个日志文件大小 |
| `innodb_log_files_in_group` | 2 | 日志文件数量 |
| `innodb_log_buffer_size` | 16MB | Log Buffer 大小 |

### Redo Log 在崩溃恢复中的作用

```
崩溃恢复流程：
1. MySQL 重启
2. 读取 Redo Log（从检查点开始）
3. 重做（REDO）所有已记录但未刷盘的事务
4. 读取 Undo Log
5. 回滚（UNDO）未提交的事务
6. 恢复正常服务
```

> **Redo Log 是"前滚"的**：把已提交事务的修改重做，即使刷盘失败也能恢复。

---

## Undo Log：事务的"已做事撤销"

### 为什么需要 Undo Log

Redo Log 记录的是"正向操作"，用于恢复已提交事务。

但如果是**未提交的事务**呢？或者事务**回滚**呢？这就需要 Undo Log。

```
Undo Log 的两个作用：
1. 事务回滚：把修改前的值恢复回去
2. MVCC：提供历史版本供其他事务读取
```

### Undo Log 记录的是什么

Undo Log 记录的是**"反向操作"**——也就是"怎么撤销"。

```sql
-- 原始数据：id=1, name='Amy', balance=1000

-- UPDATE orders SET name='Tom', balance=balance-100 WHERE id=1;

Undo Log 记录：
{
    type: UPDATE,
    table: 'orders',
    where: id=1,
    before_image: { name: 'Amy', balance: 1000 },  -- 旧值
    after_image:  { name: 'Tom', balance: 900 }     -- 新值
}
```

回滚时：用 before_image 覆盖当前数据即可。

### Undo Log 与版本链

Undo Log 是 MVCC 版本链的载体：

```
聚簇索引记录：
id=1, name='Tom', TRX_ID=200, ROLL_PTR ─────────────────┐
                                                         ↓
Undo Log（事务200的UPDATE）：                      ┌─────────────────────┐
┌─────────────────────────┐                        │ id=1, name='Amy',   │
│ UPDATE: name 'Amy'→'Tom' │ ←─────────────┐       │ TRX_ID=200,         │
│ balance: 1000→900       │              │       │ ROLL_PTR ───────────┘
└─────────────────────────┘              │       │ name='Tom'          │
                                          │       └─────────────────────┘
         版本链读取方向 ←─────────────────┘
         
事务A（TRX_ID=150）的 ReadView：
  row.trx_id=200 在活跃列表？否（已提交）
  但沿着版本链走，找到旧版本 TRX_ID=100
  TRX_ID=100 < min_trx_id → 可见
  → 事务A 看到 name='Amy'
```

### Undo Log 的物理存储

```
Undo Log 存储在系统表空间（ibdata）或独立的 Undo 表空间中。

InnoDB 会在 Rollback Segment 中维护 Undo Page：

┌─────────────────────────────────────────┐
│    Rollback Segment（回滚段）            │
│  ┌───────────────────────────────────┐ │
│  │  Undo Slot 1 → Undo Log 1         │ │
│  │  Undo Slot 2 → Undo Log 2         │ │
│  │  Undo Slot 3 → (空)               │ │
│  │  ...                               │ │
│  └───────────────────────────────────┘ │
└─────────────────────────────────────────┘
```

| 参数 | 说明 |
|-----|------|
| `innodb_rollback_segments` | 回滚段数量（默认 128） |
| `innodb_undo_tablespaces` | 独立 Undo 表空间数量 |
| `innodb_undo_log_truncate` | 是否自动清理 Undo Log |

### Undo Log 的 purge

Undo Log 不能无限增长，purge 线程定期清理：

```
Undo Log 清理条件：
1. 没有活动事务需要这个 Undo Log 版本
2. 这个 Undo Log 产生的 ReadView 已经被"超过"
3. purge 线程将其标记为空闲
```

---

## Redo + Undo 的协同

### 两阶段提交：Redo + Binlog

这是 MySQL 最经典也是最复杂的机制之一。

```
普通事务提交流程（无 Binlog）：
1. 事务提交
2. 写 Redo Log（prepare 阶段）
3. 刷盘
4. 写 Undo Log
5. 提交完成

两阶段提交（有 Binlog）：
┌────────────────────────────┐
│  1. InnoDB：Redo Log prepare     │
│     写入 Redo Log，状态=prepare   │
│     刷盘（fsync）                  │
├────────────────────────────┤
│  2. MySQL Server：写 Binlog      │
│     写入 Binlog                   │
│     刷盘（fsync）                  │
├────────────────────────────┤
│  3. InnoDB：Commit               │
│     Redo Log 状态改为 commit      │
│     事务提交完成                  │
└────────────────────────────┘
```

### 为什么需要两阶段提交？

```
问题：如果只写 Redo Log，不写 Binlog？

事务提交成功，Redo Log 已刷盘
崩溃恢复：根据 Redo Log 恢复数据
但主从复制时，从库没有这条数据！
主从不一致！

问题：如果只写 Binlog，不写 Redo Log？

Binlog 已刷盘，但数据页还没刷盘
崩溃恢复：从 Binlog 恢复？但 MySQL 无法从 Binlog 恢复用户数据
数据丢失！
```

**两阶段提交保证了：Binlog 和 Redo Log 的数据一致性。**

```
崩溃恢复时的判断：
┌────────────────────────────────────────────────┐
│ Redo Log 有 | Binlog 有 | 结果                   │
├────────────────────────────────────────────────┤
│ prepare | 有     | COMMIT（重做）              │
│ prepare | 没有   | ROLLBACK（撤销）             │
│ commit  | 有     | COMMIT（重做）              │
│ commit  | 没有   | 不可能发生                   │
└────────────────────────────────────────────────┘
```

### 性能优化：组提交

两阶段提交虽然保证了一致性，但性能较差。MySQL 通过**组提交（Group Commit）**优化：

```sql
-- 多个事务的 Binlog 可以"打包"一次 fsync
-- 多个事务的 Redo Log prepare 可以合并

-- 查看组提交统计
SHOW STATUS LIKE 'innodb_log%';
-- Innodb_log_waits：因日志刷盘等待的次数
-- Innodb_os_log_pending_fsyncs：待刷盘的日志数
```

---

## 日志参数调优

```sql
-- Redo Log 大小
SHOW VARIABLES LIKE 'innodb_log_file_size';
-- 推荐：单个文件 1GB，总大小 4GB~8GB

-- Log Buffer 大小
SHOW VARIABLES LIKE 'innodb_log_buffer_size';
-- 默认 16MB，对于大事务可适当调大

-- 刷盘策略
SHOW VARIABLES LIKE 'innodb_flush_log_at_trx_commit';
-- 生产建议：1（金融场景）或 2（可容忍少量丢失）

-- Undo Log 表空间（MySQL 8.0）
SHOW VARIABLES LIKE 'innodb_undo%';
-- innodb_undo_tablespaces = 2（推荐）
-- innodb_undo_log_truncate = ON（自动清理）
```

---

## 小结

Redo Log vs Undo Log：

| 维度 | Redo Log | Undo Log |
|-----|---------|---------|
| 记录什么 | 修改后的值（新值） | 修改前的值（旧值） |
| 记录格式 | 物理（页+偏移） | 逻辑（SQL 逆操作） |
| 作用 | 崩溃恢复（重做） | 事务回滚 + MVCC |
| 持久性 | 必须持久化（事务提交时刷盘） | 不需要持久化 |
| 何时清理 | 已刷盘的可被覆盖 | 无事务需要时purge |

两阶段提交：Redo Log prepare + Binlog + Commit，保证主从数据一致。

---

## 下一步

Binlog 是 MySQL 主从复制的核心日志。它记录了什么？怎么用它恢复数据或做增量同步？

从 [Binlog 详解](/database/mysql/transaction/log/binlog) 继续。
