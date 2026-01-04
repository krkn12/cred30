-- Migration: 030_create_academy_marketplace.sql
-- Transforma a Academia em um marketplace estilo Udemy

-- Tabela de Cursos
CREATE TABLE IF NOT EXISTS academy_courses (
    id SERIAL PRIMARY KEY,
    author_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    price DECIMAL(10, 2) DEFAULT 0.00,
    video_url VARCHAR(255) NOT NULL, -- Link do YouTube/Vimeo
    thumbnail_url VARCHAR(255),
    category VARCHAR(50),
    status VARCHAR(20) DEFAULT 'PENDING', -- PENDING, APPROVED, REJECTED
    enrollment_count INTEGER DEFAULT 0,
    rating_avg DECIMAL(3, 2) DEFAULT 0.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de Matrículas (Vendas)
CREATE TABLE IF NOT EXISTS academy_enrollments (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    course_id INTEGER NOT NULL REFERENCES academy_courses(id) ON DELETE CASCADE,
    amount_paid DECIMAL(10, 2) NOT NULL,
    payment_method VARCHAR(20), -- balance, pix, card
    payment_id VARCHAR(100), -- ID da transação ou Asaas
    status VARCHAR(20) DEFAULT 'COMPLETED', -- COMPLETED, PENDING
    purchased_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(user_id, course_id)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_academy_courses_author ON academy_courses(author_id);
CREATE INDEX IF NOT EXISTS idx_academy_courses_status ON academy_courses(status);
CREATE INDEX IF NOT EXISTS idx_academy_enrollments_user ON academy_enrollments(user_id);
CREATE INDEX IF NOT EXISTS idx_academy_enrollments_course ON academy_enrollments(course_id);

-- Comentários
COMMENT ON TABLE academy_courses IS 'Tabela de cursos do marketplace da Academia';
COMMENT ON TABLE academy_enrollments IS 'Controle de vendas e acesso aos cursos';
