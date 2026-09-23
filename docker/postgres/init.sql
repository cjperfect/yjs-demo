-- pgvector 扩展（pgvector/pgvector 镜像自带）
CREATE EXTENSION IF NOT EXISTS vector;

-- Yjs 协同文档使用的数据库初始化
-- 注意：Yjs 文档二进制 state 单独走 app 层 SQL，这里只做扩展预装
