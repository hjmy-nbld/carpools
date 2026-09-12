"""生成 schema.sql（MySQL DDL），供 seed.py 或手动执行建表。"""
from sqlalchemy.schema import CreateTable, CreateIndex
from app.database import Base, engine
from app import models  # noqa: F401  确保模型注册到 metadata

# 按依赖顺序输出表（避免外键/引用顺序问题；本表无外键，按声明顺序即可）
tables = list(Base.metadata.sorted_tables)

with open("schema.sql", "w", encoding="utf-8") as f:
    f.write("-- 同路人后端数据库建表脚本（MySQL 5.7+）\n")
    f.write("-- 由 app/models.py 通过 SQLAlchemy DDL 编译器自动生成\n")
    f.write("-- 时间字段统一为 BIGINT，存储毫秒时间戳\n\n")
    f.write("SET NAMES utf8mb4;\n")
    f.write("SET FOREIGN_KEY_CHECKS = 0;\n\n")

    for table in tables:
        f.write(f"-- ---------- {table.name} ----------\n")
        f.write(f"DROP TABLE IF EXISTS `{table.name}`;\n")
        ddl = str(CreateTable(table).compile(dialect=engine.dialect))
        f.write(ddl.rstrip() + ";\n\n")

    # 索引（MySQL 下索引为独立 CREATE INDEX 语句）
    f.write("-- ---------- 索引 ----------\n")
    index_count = 0
    for table in tables:
        for index in table.indexes:
            ddl = str(CreateIndex(index).compile(dialect=engine.dialect))
            f.write(ddl.rstrip() + ";\n")
            index_count += 1
    if index_count == 0:
        f.write("-- 无额外索引\n")
    f.write("\n")

    f.write("SET FOREIGN_KEY_CHECKS = 1;\n")

print(f"[gen_schema] 已生成 schema.sql，共 {len(tables)} 张表，{index_count} 个索引")
for t in tables:
    print(f"  - {t.name}")

