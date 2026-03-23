export const mysqlSidebar = [
    // {
    //     text: 'MySQL 数据库',
    //     collapsed: true,
    //     items: [
    // 第一部分：MySQL 基础入门
    {
        text: 'MySQL 基础入门',
        collapsed: true,
        items: [
            { text: 'MySQL 教程简介', link: '/mysql/basic/overview.md' },
            { text: '数据库核心概念（为什么用/常用DBMS对比）', link: '/mysql/basic/db-concept.md' },
            { text: 'RDBMS vs 非RDBMS/ER模型与表关系', link: '/mysql/basic/rdbms-er.md' },
            {
                text: 'MySQL 安装与配置',
                collapsed: true,
                items: [
                    { text: 'MySQL8.0 卸载/下载/安装/配置', link: '/mysql/basic/install/8.0.md' },
                    { text: 'MySQL5.7 安装与字符集设置', link: '/mysql/basic/install/5.7.md' },
                    { text: '安装常见问题（服务启动/用户登录）', link: '/mysql/basic/install/faq.md' },
                    { text: 'Navicat/SQLyog/dbeaver 工具使用', link: '/mysql/basic/install/tools.md' }
                ]
            },
            { text: 'MySQL 目录结构', link: '/mysql/basic/dir-structure.md' },
            { text: 'Linux 环境安装 MySQL（8.0/5.7）', link: '/mysql/basic/install/linux.md' },
            { text: 'Linux 下 MySQL 远程连接（SQLyog）', link: '/mysql/basic/install/linux-remote.md' }
        ]
    },

    // 第二部分：SQL 核心语法（基础查询）
    {
        text: 'SQL 核心语法（基础查询）',
        collapsed: true,
        items: [
            { text: 'SQL 概述/分类/使用规范', link: '/mysql/sql/basic/overview.md' },
            { text: '基本 SELECT...FROM 结构', link: '/mysql/sql/basic/select-from.md' },
            { text: '列别名/去重/NULL/排序（DESC）', link: '/mysql/sql/basic/column-ops.md' },
            { text: 'WHERE 过滤数据', link: '/mysql/sql/basic/where.md' },
            {
                text: '运算符',
                collapsed: true,
                items: [
                    { text: '算术运算符', link: '/mysql/sql/basic/operator/arithmetic.md' },
                    { text: '比较运算符', link: '/mysql/sql/basic/operator/compare.md' },
                    { text: '逻辑/位运算符', link: '/mysql/sql/basic/operator/logic-bit.md' }
                ]
            },
            { text: 'ORDER BY 排序/LIMIT 分页', link: '/mysql/sql/basic/sort-pagination.md' },
            {
                text: '多表查询',
                collapsed: true,
                items: [
                    { text: '笛卡尔积/等值/非等值连接', link: '/mysql/sql/join/equi-non-equi.md' },
                    { text: '自连接/内连接/外连接（SQL92/99）', link: '/mysql/sql/join/inner-outer.md' },
                    { text: '7种JOIN操作/NATURAL JOIN/USING', link: '/mysql/sql/join/7join.md' }
                ]
            },
            {
                text: '函数',
                collapsed: true,
                items: [
                    { text: '单行函数（数值/字符串/日期）', link: '/mysql/sql/function/single-row.md' },
                    { text: '流程控制/加密/信息函数', link: '/mysql/sql/function/control-encrypt.md' },
                    { text: '聚合函数/GROUP BY/HAVING', link: '/mysql/sql/function/aggregate.md' }
                ]
            },
            {
                text: '子查询',
                collapsed: true,
                items: [
                    { text: '子查询分类/单行子查询', link: '/mysql/sql/subquery/single-row.md' },
                    { text: '多行子查询/相关子查询', link: '/mysql/sql/subquery/multi-row-correlated.md' }
                ]
            },
            { text: 'MySQL8.0 新特性（窗口函数/公用表表达式）', link: '/mysql/sql/advanced/window-cte.md' }
        ]
    },

    // 第三部分：数据库对象管理
    {
        text: '数据库对象管理',
        collapsed: true,
        items: [
            {
                text: '库与表管理',
                collapsed: true,
                items: [
                    { text: '数据库（创建/修改/删除）', link: '/mysql/object/db.md' },
                    { text: '数据类型（整型/浮点/日期/字符串/JSON）', link: '/mysql/object/data-type.md' },
                    { text: '表（创建/修改/重命名/删除/清空）', link: '/mysql/object/table.md' },
                    { text: '阿里命名规范/database/mysql8 DDL原子化', link: '/mysql/object/naming-rule.md' }
                ]
            },
            {
                text: '数据操作（DML）',
                collapsed: true,
                items: [
                    { text: '添加数据（INSERT）', link: '/mysql/object/dml/insert.md' },
                    { text: '更新/删除（UPDATE/DELETE）/计算列', link: '/mysql/object/dml/update-delete.md' },
                    { text: '事务控制（COMMIT/ROLLBACK）', link: '/mysql/object/dml/transaction.md' }
                ]
            },
            {
                text: '约束',
                collapsed: true,
                items: [
                    { text: '约束分类/非空/唯一/主键/AUTO_INCREMENT', link: '/mysql/object/constraint/basic.md' },
                    { text: '外键/检查/默认值约束', link: '/mysql/object/constraint/foreign-check.md' }
                ]
            },
            {
                text: '视图/存储过程/函数',
                collapsed: true,
                items: [
                    { text: '视图（创建/查看/更新/删除）', link: '/mysql/object/view.md' },
                    { text: '存储过程（创建/调用/修改/删除）', link: '/mysql/object/procedure.md' },
                    { text: '存储函数（创建/调用/区别于存储过程）', link: '/mysql/object/function.md' }
                ]
            },
            {
                text: '变量与流程控制',
                collapsed: true,
                items: [
                    { text: '系统变量/用户变量/局部变量', link: '/mysql/object/variable.md' },
                    { text: '分支结构（IF/CASE）', link: '/mysql/object/control/branch.md' },
                    { text: '循环结构（LOOP/WHILE/REPEAT）', link: '/mysql/object/control/loop.md' },
                    { text: 'LEAVE/ITERATE/游标/错误处理', link: '/mysql/object/control/cursor-error.md' }
                ]
            },
            { text: '触发器（创建/查看/删除）', link: '/mysql/object/trigger.md' }
        ]
    },

    // 第四部分：MySQL 高级特性（基础）
    {
        text: 'MySQL 高级特性（基础）',
        collapsed: true,
        items: [
            { text: '字符集与比较规则（原理/修改）', link: '/mysql/advanced/charset.md' },
            { text: 'SQL 大小写/sql_mode 设置', link: '/mysql/advanced/sql-mode.md' },
            { text: 'MySQL 目录结构/表的文件存储', link: '/mysql/advanced/file-storage.md' },
            {
                text: '用户与权限',
                collapsed: true,
                items: [
                    { text: '用户（创建/修改/删除/密码管理）', link: '/mysql/advanced/user.md' },
                    { text: '权限管理/访问控制/角色使用', link: '/mysql/advanced/permission.md' }
                ]
            },
            { text: 'MySQL 逻辑架构/SQL 执行流程', link: '/mysql/advanced/architecture.md' },
            {
                text: '存储引擎',
                collapsed: true,
                items: [
                    { text: '存储引擎设置/InnoDB vs MyISAM', link: '/mysql/advanced/engine/innodb-myisam.md' },
                    { text: 'Archive/CSV/Memory 引擎', link: '/mysql/advanced/engine/other.md' }
                ]
            }
        ]
    },

    // 第五部分：索引与性能优化
    {
        text: '索引与性能优化',
        collapsed: true,
        items: [
            {
                text: '索引基础',
                collapsed: true,
                items: [
                    { text: '索引的作用/优缺点/设计方案', link: '/mysql/optimize/index/basic.md' },
                    { text: '聚簇/二级/联合索引/B+树/Hash索引', link: '/mysql/optimize/index/type.md' },
                    { text: '索引分类/添加/删除/降序/隐藏索引', link: '/mysql/optimize/index/ops.md' },
                    { text: '适合/不适合创建索引的场景', link: '/mysql/optimize/index/scenario.md' }
                ]
            },
            {
                text: 'InnoDB 存储结构',
                collapsed: true,
                items: [
                    { text: '页结构（文件头/记录/页目录）', link: '/mysql/optimize/innodb/page.md' },
                    { text: '行格式（Compact/Dynamic/行溢出）', link: '/mysql/optimize/innodb/row-format.md' },
                    { text: '区/段/碎片区/表空间', link: '/mysql/optimize/innodb/space.md' }
                ]
            },
            {
                text: 'SQL 优化工具与方法',
                collapsed: true,
                items: [
                    { text: '慢查询日志/SHOW PROFILE', link: '/mysql/optimize/tool/slow-log.md' },
                    { text: 'EXPLAIN 全字段剖析（type/key/extra）', link: '/mysql/optimize/tool/explain.md' },
                    { text: 'trace/EXPLAIN 格式/Sys schema', link: '/mysql/optimize/tool/trace.md' }
                ]
            },
            {
                text: 'SQL 优化实战',
                collapsed: true,
                items: [
                    { text: '索引失效的11种情况', link: '/mysql/optimize/sql/index-invalid.md' },
                    { text: 'JOIN/子查询/排序/GROUP BY 优化', link: '/mysql/optimize/sql/join-subquery.md' },
                    { text: '分页优化/覆盖索引/ICP', link: '/mysql/optimize/sql/pagination-covering.md' },
                    { text: '主键设计/范式与反范式/数据库设计', link: '/mysql/optimize/sql/design.md' }
                ]
            },
            { text: '数据库调优（硬件/参数/大表优化）', link: '/mysql/optimize/overall-tuning.md' }
        ]
    },

    // 第六部分：事务、锁与 MVCC
    {
        text: '事务、锁与 MVCC',
        collapsed: true,
        items: [
            {
                text: '事务',
                collapsed: true,
                items: [
                    { text: '事务 ACID/状态/显式/隐式事务', link: '/mysql/transaction/basic.md' },
                    { text: '并发问题/4种隔离级别/幻读解决', link: '/mysql/transaction/isolation.md' }
                ]
            },
            {
                text: '锁机制',
                collapsed: true,
                items: [
                    { text: '锁概述/S锁/X锁/意向锁', link: '/mysql/transaction/lock/basic.md' },
                    { text: '表锁（自增锁/元数据锁）', link: '/mysql/transaction/lock/table.md' },
                    { text: '行锁（记录锁/间隙锁/临键锁）', link: '/mysql/transaction/lock/row.md' },
                    { text: '乐观锁/悲观锁/全局锁/死锁', link: '/mysql/transaction/lock/optimistic-pessimistic.md' },
                    { text: '锁监控/内存结构', link: '/mysql/transaction/lock/monitor.md' }
                ]
            },
            {
                text: 'MVCC',
                collapsed: true,
                items: [
                    { text: 'MVCC 核心（隐藏字段/UndoLog/ReadView）', link: '/mysql/transaction/mvcc/basic.md' },
                    { text: 'MVCC 与隔离级别/幻读解决', link: '/mysql/transaction/mvcc/isolation.md' }
                ]
            },
            {
                text: '日志体系',
                collapsed: true,
                items: [
                    { text: '日志概述/通用查询/错误日志', link: '/mysql/transaction/log/basic.md' },
                    { text: 'Redo Log/Undo Log/刷盘策略', link: '/mysql/transaction/log/redo-undo.md' },
                    { text: 'Binlog（参数/恢复/两阶段提交）', link: '/mysql/transaction/log/binlog.md' }
                ]
            }
        ]
    },

    // 第七部分：日志、备份与主从复制
    {
        text: '日志、备份与主从复制',
        collapsed: true,
        items: [
            { text: '中继日志/主从复制原理', link: '/mysql/replication/basic.md' },
            { text: '一主一从搭建/同步一致性/format设置', link: '/mysql/replication/master-slave.md' },
            {
                text: '备份与恢复',
                collapsed: true,
                items: [
                    { text: '备份概述/database/mysqldump 逻辑备份', link: '/mysql/replication/backup/logical.md' },
                    { text: '物理备份/恢复/数据迁移', link: '/mysql/replication/backup/physical.md' }
                ]
            }
        ]
    }
    //     ]
    // }
]
