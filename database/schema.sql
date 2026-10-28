-- Criação do banco de dados se não existir
CREATE DATABASE IF NOT EXISTS movimento_antioquia
CHARACTER SET utf8mb4
COLLATE utf8mb4_unicode_ci;

USE movimento_antioquia;

-- 1. Tabela de Configurações do Sistema
CREATE TABLE IF NOT EXISTS configuracoes (
    id INT PRIMARY KEY AUTO_INCREMENT,
    cfg_pix_ativo TINYINT(1) DEFAULT 1,
    cfg_manutencao_noticias TINYINT(1) DEFAULT 0,
    cfg_manutencao_relogio TINYINT(1) DEFAULT 0,
    cfg_manutencao_quadrotito TINYINT(1) DEFAULT 0
);

-- Inserir configuração inicial se não existir
INSERT IGNORE INTO configuracoes (id, cfg_pix_ativo, cfg_manutencao_noticias, cfg_manutencao_relogio, cfg_manutencao_quadrotito)
VALUES (1, 1, 0, 0, 0);

-- 2. Tabela de Notícias
CREATE TABLE IF NOT EXISTS noticias (
    id_noticia INT PRIMARY KEY AUTO_INCREMENT,
    ntc_titulo VARCHAR(255) NOT NULL,
    ntc_corpo_mensagem LONGTEXT NOT NULL,
    ntc_imagem_fundo VARCHAR(500),
    ntc_data_publicacao DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 3. Tabela de Missionários
CREATE TABLE IF NOT EXISTS missionarios (
    id_missionario INT PRIMARY KEY AUTO_INCREMENT,
    mis_primeiro_nome VARCHAR(100) NOT NULL,
    mis_sobrenome VARCHAR(100),
    mis_cidade VARCHAR(100),
    mis_pais VARCHAR(100),
    mis_imagem_url VARCHAR(500),
    mis_data_nascimento DATE,
    mis_descricao TEXT,
    mis_historia LONGTEXT
);

-- 4. Tabela de Eventos
CREATE TABLE IF NOT EXISTS eventos (
    id_evento INT PRIMARY KEY AUTO_INCREMENT,
    evt_titulo VARCHAR(255) NOT NULL,
    evt_descricao TEXT,
    evt_data_inicial DATETIME NOT NULL,
    evt_data_final DATETIME NOT NULL
);

-- 5. Tabela de Relógio de Oração
CREATE TABLE IF NOT EXISTS relogio_oracao (
    id_relogio INT PRIMARY KEY AUTO_INCREMENT,
    rel_titulo VARCHAR(255) NOT NULL,
    rel_data_relogio DATE NOT NULL
);

-- 6. Tabela de Voluntários do Relógio
CREATE TABLE IF NOT EXISTS voluntarios (
    id_voluntario INT PRIMARY KEY AUTO_INCREMENT,
    id_relogio INT NOT NULL,
    vol_nome_completo VARCHAR(255) NOT NULL,
    vol_horario_escolhido VARCHAR(50) NOT NULL,
    CONSTRAINT fk_voluntarios_relogio FOREIGN KEY (id_relogio)
        REFERENCES relogio_oracao(id_relogio) ON DELETE CASCADE
);

-- 7. Tabela de Motivos de Oração
CREATE TABLE IF NOT EXISTS motivos_oracao (
    id_motivo INT PRIMARY KEY AUTO_INCREMENT,
    id_relogio INT NOT NULL,
    mot_horario VARCHAR(50) DEFAULT NULL,
    mot_descricao TEXT NOT NULL,
    CONSTRAINT fk_motivos_relogio FOREIGN KEY (id_relogio)
        REFERENCES relogio_oracao(id_relogio) ON DELETE CASCADE,
    UNIQUE KEY uq_relogio_mot_horario (id_relogio, mot_horario)
);

-- 8. Tabela de Quadro Tito
CREATE TABLE IF NOT EXISTS quadro_tito (
    id_quadro INT PRIMARY KEY AUTO_INCREMENT,
    qdt_data_inicial DATE NOT NULL,
    qdt_data_final DATE NOT NULL,
    qdt_data_criacao DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 9. Tabela de Post-its do Quadro Tito
CREATE TABLE IF NOT EXISTS post_it (
    id_postit INT PRIMARY KEY AUTO_INCREMENT,
    id_quadro INT NOT NULL,
    pst_conteudo TEXT NOT NULL,
    CONSTRAINT fk_postit_quadro FOREIGN KEY (id_quadro)
        REFERENCES quadro_tito(id_quadro) ON DELETE CASCADE
);

-- 10. Tabela de Sugestões de Post-it
CREATE TABLE IF NOT EXISTS postit_sugestoes (
    id_sugestao INT PRIMARY KEY AUTO_INCREMENT,
    id_quadro INT NOT NULL,
    sug_nome_autor VARCHAR(150),
    sug_conteudo TEXT NOT NULL,
    sug_status ENUM('pendente', 'aprovado', 'recusado') DEFAULT 'pendente',
    sug_data_criacao DATETIME DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_sugestoes_quadro FOREIGN KEY (id_quadro)
        REFERENCES quadro_tito(id_quadro) ON DELETE CASCADE
);

-- 11. Tabela de Inscrições Push (Notificações)
CREATE TABLE IF NOT EXISTS push_subscriptions (
    id_subscription INT PRIMARY KEY AUTO_INCREMENT,
    endpoint VARCHAR(500) NOT NULL UNIQUE,
    p256dh VARCHAR(255) NOT NULL,
    auth VARCHAR(255) NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 12. Tabela de Solicitações de Voluntários do Relógio de Oração
CREATE TABLE IF NOT EXISTS solicitacoes_oracao (
    id_solicitacao INT PRIMARY KEY AUTO_INCREMENT,
    id_relogio INT NOT NULL,
    sol_nome_completo VARCHAR(255) NOT NULL,
    sol_horario_escolhido VARCHAR(50) NOT NULL,
    sol_status ENUM('pendente', 'aprovado', 'recusado') DEFAULT 'pendente',
    sol_data_criacao DATETIME DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_solicitacoes_relogio FOREIGN KEY (id_relogio)
        REFERENCES relogio_oracao(id_relogio) ON DELETE CASCADE
);
