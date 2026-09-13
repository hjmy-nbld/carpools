-- 同路人后端数据库建表脚本（MySQL 5.7+）
-- 由 app/models.py 通过 SQLAlchemy DDL 编译器自动生成
-- 时间字段统一为 BIGINT，存储毫秒时间戳

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ---------- admin_logs ----------
DROP TABLE IF EXISTS `admin_logs`;

CREATE TABLE admin_logs (
	id VARCHAR(64) NOT NULL, 
	admin_id VARCHAR(64), 
	admin_name VARCHAR(64), 
	action VARCHAR(64), 
	target VARCHAR(256), 
	detail TEXT, 
	created_at BIGINT, 
	PRIMARY KEY (id)
);

-- ---------- admins ----------
DROP TABLE IF EXISTS `admins`;

CREATE TABLE admins (
	id VARCHAR(64) NOT NULL, 
	username VARCHAR(64) NOT NULL, 
	password_hash VARCHAR(128) NOT NULL, 
	salt VARCHAR(32) NOT NULL, 
	name VARCHAR(64), 
	created_at BIGINT, 
	PRIMARY KEY (id)
);

-- ---------- announcements ----------
DROP TABLE IF EXISTS `announcements`;

CREATE TABLE announcements (
	id VARCHAR(64) NOT NULL, 
	title VARCHAR(128) NOT NULL, 
	content TEXT, 
	sort INTEGER, 
	PRIMARY KEY (id)
);

-- ---------- messages ----------
DROP TABLE IF EXISTS `messages`;

CREATE TABLE messages (
	id VARCHAR(64) NOT NULL, 
	group_id VARCHAR(64) NOT NULL, 
	from_openid VARCHAR(64), 
	from_name VARCHAR(128), 
	avatar TEXT, 
	type VARCHAR(16), 
	content TEXT, 
	created_at BIGINT, 
	PRIMARY KEY (id)
);

-- ---------- reports ----------
DROP TABLE IF EXISTS `reports`;

CREATE TABLE reports (
	id VARCHAR(64) NOT NULL, 
	group_id VARCHAR(64), 
	reporter_openid VARCHAR(64), 
	reported_openid VARCHAR(64), 
	reason VARCHAR(64), 
	images JSON, 
	description TEXT, 
	status VARCHAR(16), 
	created_at BIGINT, 
	admin_note TEXT, 
	PRIMARY KEY (id)
);

-- ---------- reviews ----------
DROP TABLE IF EXISTS `reviews`;

CREATE TABLE reviews (
	id VARCHAR(64) NOT NULL, 
	group_id VARCHAR(64), 
	from_openid VARCHAR(64), 
	to_openid VARCHAR(64), 
	score INTEGER, 
	tags JSON, 
	comment TEXT, 
	created_at BIGINT, 
	PRIMARY KEY (id)
);

-- ---------- ride_groups ----------
DROP TABLE IF EXISTS `ride_groups`;

CREATE TABLE ride_groups (
	id VARCHAR(64) NOT NULL, 
	direction VARCHAR(32) NOT NULL, 
	station_name VARCHAR(128), 
	exit_name VARCHAR(128), 
	target_size INTEGER, 
	status VARCHAR(16), 
	members JSON, 
	price INTEGER, 
	created_at BIGINT, 
	completed_at BIGINT, 
	canceled_at BIGINT, 
	PRIMARY KEY (id)
);

-- ---------- ride_requests ----------
DROP TABLE IF EXISTS `ride_requests`;

CREATE TABLE ride_requests (
	id VARCHAR(64) NOT NULL, 
	openid VARCHAR(64) NOT NULL, 
	direction VARCHAR(32) NOT NULL, 
	station_id VARCHAR(64), 
	station_name VARCHAR(128), 
	exit_id VARCHAR(64), 
	exit_name VARCHAR(128), 
	target_size INTEGER, 
	price INTEGER, 
	wait_location VARCHAR(128), 
	outfit VARCHAR(128), 
	photo TEXT, 
	status VARCHAR(16), 
	group_id VARCHAR(64), 
	created_at BIGINT, 
	PRIMARY KEY (id)
);

-- ---------- stations ----------
DROP TABLE IF EXISTS `stations`;

CREATE TABLE stations (
	id VARCHAR(64) NOT NULL, 
	direction VARCHAR(32), 
	name VARCHAR(128) NOT NULL, 
	to_name VARCHAR(128), 
	type VARCHAR(16), 
	exits JSON, 
	sort INTEGER, 
	PRIMARY KEY (id)
);

-- ---------- users ----------
DROP TABLE IF EXISTS `users`;

CREATE TABLE users (
	openid VARCHAR(64) NOT NULL, 
	nick_name VARCHAR(64) NOT NULL, 
	avatar TEXT, 
	real_name VARCHAR(32), 
	school VARCHAR(128), 
	credit_score INTEGER, 
	status VARCHAR(16), 
	frozen_until BIGINT, 
	last_leave_at BIGINT, 
	credit_rewards JSON, 
	default_wait_location VARCHAR(128), 
	default_outfit VARCHAR(128), 
	default_photo TEXT, 
	finished_count INTEGER, 
	is_bot BOOL, 
	created_at BIGINT, 
	PRIMARY KEY (openid)
);

-- ---------- 索引 ----------
CREATE INDEX ix_admin_logs_created_at ON admin_logs (created_at);
CREATE INDEX ix_admin_logs_admin_id ON admin_logs (admin_id);
CREATE UNIQUE INDEX ix_admins_username ON admins (username);
CREATE INDEX ix_messages_group_id ON messages (group_id);
CREATE INDEX ix_messages_created_at ON messages (created_at);
CREATE INDEX ix_reports_reporter_openid ON reports (reporter_openid);
CREATE INDEX ix_reports_group_id ON reports (group_id);
CREATE INDEX ix_reviews_group_id ON reviews (group_id);
CREATE INDEX ix_reviews_from_openid ON reviews (from_openid);
CREATE INDEX ix_ride_groups_status ON ride_groups (status);
CREATE INDEX ix_ride_requests_status ON ride_requests (status);
CREATE INDEX ix_ride_requests_group_id ON ride_requests (group_id);
CREATE INDEX ix_ride_requests_openid ON ride_requests (openid);
CREATE INDEX ix_ride_requests_created_at ON ride_requests (created_at);
CREATE INDEX ix_stations_direction ON stations (direction);

SET FOREIGN_KEY_CHECKS = 1;
