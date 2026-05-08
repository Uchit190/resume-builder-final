CREATE DATABASE IF NOT EXISTS Resume_builder
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE Resume_builder;

CREATE TABLE IF NOT EXISTS users (
  id CHAR(36) PRIMARY KEY,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  name VARCHAR(220) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  job_title VARCHAR(160) NULL,
  career_level VARCHAR(120) NULL,
  resume_type ENUM('technical', 'non-technical') NOT NULL DEFAULT 'technical',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_users_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS resumes (
  id CHAR(36) PRIMARY KEY,
  owner_type ENUM('user', 'guest') NOT NULL,
  owner_id VARCHAR(191) NOT NULL,
  type ENUM('technical', 'non-technical') NOT NULL,
  title VARCHAR(200) NOT NULL,
  data JSON NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_resume_owner_type (owner_type, owner_id, type),
  INDEX idx_resumes_owner_updated (owner_type, owner_id, updated_at),
  INDEX idx_resumes_type (type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS voice_sessions (
  id CHAR(36) PRIMARY KEY,
  resume_id CHAR(36) NULL,
  owner_type ENUM('user', 'guest') NOT NULL,
  owner_id VARCHAR(191) NOT NULL,
  resume_type ENUM('technical', 'non-technical') NOT NULL,
  language VARCHAR(20) NULL,
  transcript JSON NOT NULL,
  generated_data JSON NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_voice_session_resume (resume_id),
  INDEX idx_voice_sessions_owner_updated (owner_type, owner_id, updated_at),
  CONSTRAINT fk_voice_sessions_resume
    FOREIGN KEY (resume_id)
    REFERENCES resumes(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
