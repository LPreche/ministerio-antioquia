// c:\github\ministerio-antioquia\server.js
const express = require('express');
const db = require('./connection');
const path = require('path');
const app = express();
const port = 3000;

// Serve os arquivos estáticos (HTML, CSS, JS, Imagens)
app.use(express.static(path.join(__dirname, '.')));
app.use(express.json());

// Endpoint para buscar as notícias do banco de dados
app.get('/api/noticias', async (req, res) => {
    try {
        // Adicionado id_noticia para ser usado no admin
        const [rows] = await db.execute('SELECT id_noticia, ntc_titulo, ntc_data_publicacao, ntc_corpo_mensagem, ntc_imagem_fundo FROM noticias ORDER BY ntc_data_publicacao DESC');
        res.json(rows);
    } catch (error) {
        console.error('Erro ao buscar notícias:', error);
        res.status(500).json({ error: 'Erro interno ao buscar notícias' });
    }
});

// Endpoint para buscar UMA notícia pelo ID (para edição)
app.get('/api/noticias/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const [rows] = await db.execute('SELECT id_noticia, ntc_titulo, ntc_data_publicacao, ntc_corpo_mensagem, ntc_imagem_fundo FROM noticias WHERE id_noticia = ?', [id]);
        if (rows.length === 0) {
            return res.status(404).json({ error: 'Notícia não encontrada' });
        }
        res.json(rows[0]);
    } catch (error) {
        console.error('Erro ao buscar notícia por ID:', error);
        res.status(500).json({ error: 'Erro interno ao buscar notícia' });
    }
});

// Endpoint para ADICIONAR uma nova notícia
app.post('/api/noticias', async (req, res) => {
    try { // ntc_data_publicacao
        const { ntc_titulo, ntc_corpo_mensagem, ntc_imagem_fundo } = req.body;
        const ntc_data_publicacao = new Date();
        const [result] = await db.execute(
            'INSERT INTO noticias (ntc_titulo, ntc_corpo_mensagem, ntc_imagem_fundo, ntc_data_publicacao) VALUES (?, ?, ?, ?)',
            [ntc_titulo, ntc_corpo_mensagem, ntc_imagem_fundo, ntc_data_publicacao]
        );
        res.status(201).json({ id: result.insertId, ...req.body });
    } catch (error) {
        console.error('Erro ao adicionar notícia:', error);
        res.status(500).json({ error: 'Erro interno ao adicionar notícia' });
    }
});

// Endpoint para ATUALIZAR uma notícia
app.put('/api/noticias/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { ntc_titulo, ntc_corpo_mensagem, ntc_imagem_fundo } = req.body;
        await db.execute(
            'UPDATE noticias SET ntc_titulo = ?, ntc_corpo_mensagem = ?, ntc_imagem_fundo = ? WHERE id_noticia = ?',
            [ntc_titulo, ntc_corpo_mensagem, ntc_imagem_fundo, id]
        );
        res.json({ message: 'Notícia atualizada com sucesso' });
    } catch (error) {
        console.error('Erro ao atualizar notícia:', error);
        res.status(500).json({ error: 'Erro interno ao atualizar notícia' });
    }
});

// Endpoint para DELETAR uma notícia
app.delete('/api/noticias/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await db.execute('DELETE FROM noticias WHERE id_noticia = ?', [id]);
        res.status(204).send(); // No content
    } catch (error) {
        console.error('Erro ao deletar notícia:', error);
        res.status(500).json({ error: 'Erro interno ao deletar notícia' });
    }
});

// --- CRUD para Missionários ---

// GET todos
app.get('/api/missionaries', async (req, res) => {
    try {
        const [rows] = await db.execute("SELECT id_missionario, CONCAT(mis_primeiro_nome, ' ', mis_sobrenome) AS nome, mis_cidade, mis_pais, mis_imagem_url, mis_descricao, mis_historia FROM missionarios ORDER BY mis_primeiro_nome, mis_sobrenome"); // mis_descricao, mis_historia
        res.json(rows);
    } catch (error) {
        console.error('Erro ao buscar missionários:', error);
        res.status(500).json({ error: 'Erro interno ao buscar missionários' });
    }
});

// GET um por ID
app.get('/api/missionaries/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const [rows] = await db.execute('SELECT id_missionario, mis_primeiro_nome, mis_sobrenome, mis_data_nascimento, mis_cidade, mis_pais, mis_imagem_url, mis_descricao, mis_historia FROM missionarios WHERE id_missionario = ?', [id]); // mis_descricao, mis_historia
        if (rows.length === 0) {
            return res.status(404).json({ error: 'Missionário não encontrado' });
        }
        res.json(rows[0]);
    } catch (error) {
        console.error('Erro ao buscar missionário por ID:', error);
        res.status(500).json({ error: 'Erro interno ao buscar missionário' });
    }
});

// POST (criar)
app.post('/api/missionaries', async (req, res) => {
    try {
        const { mis_primeiro_nome, mis_sobrenome, mis_cidade, mis_pais, mis_imagem_url, mis_data_nascimento, mis_descricao, mis_historia } = req.body; // mis_descricao, mis_historia
        const [result] = await db.execute(
            'INSERT INTO missionarios (mis_primeiro_nome, mis_sobrenome, mis_cidade, mis_pais, mis_imagem_url, mis_data_nascimento, mis_descricao, mis_historia) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', // mis_descricao, mis_historia
            [mis_primeiro_nome, mis_sobrenome, mis_cidade, mis_pais, mis_imagem_url, mis_data_nascimento, mis_descricao, mis_historia] // mis_descricao, mis_historia
        );
        res.status(201).json({ id: result.insertId, ...req.body });
    } catch (error) {
        console.error('Erro ao adicionar missionário:', error);
        res.status(500).json({ error: 'Erro interno ao adicionar missionário' });
    }
});

// PUT (atualizar)
app.put('/api/missionaries/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { mis_primeiro_nome, mis_sobrenome, mis_cidade, mis_pais, mis_imagem_url, mis_data_nascimento, mis_descricao, mis_historia } = req.body; // mis_descricao, mis_historia
        await db.execute(
            'UPDATE missionarios SET mis_primeiro_nome = ?, mis_sobrenome = ?, mis_cidade = ?, mis_pais = ?, mis_imagem_url = ?, mis_data_nascimento = ?, mis_descricao = ?, mis_historia = ? WHERE id_missionario = ?', // mis_descricao, mis_historia
            [mis_primeiro_nome, mis_sobrenome, mis_cidade, mis_pais, mis_imagem_url, mis_data_nascimento, mis_descricao, mis_historia, id] // mis_descricao, mis_historia
        );
        res.json({ message: 'Missionário atualizado com sucesso' });
    } catch (error) {
        console.error('Erro ao atualizar missionário:', error);
        res.status(500).json({ error: 'Erro interno ao atualizar missionário' });
    }
});

// DELETE
app.delete('/api/missionaries/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await db.execute('DELETE FROM missionarios WHERE id_missionario = ?', [id]);
        res.status(204).send();
    } catch (error) {
        console.error('Erro ao deletar missionário:', error);
        res.status(500).json({ error: 'Erro interno ao deletar missionário' });
    }
});


// --- CRUD para Voluntários do Relógio de Oração ---

// GET todos os voluntários do último relógio
app.get('/api/voluntarios', async (req, res) => {
    try {
        const [relogios] = await db.execute('SELECT id_relogio FROM relogio_oracao ORDER BY rel_data_relogio DESC LIMIT 1');
        if (relogios.length === 0) {
            return res.json([]); // Retorna array vazio se não houver relógio
        }
        const latestClockId = relogios[0].id_relogio;
        const [rows] = await db.execute('SELECT id_voluntario, vol_nome_completo, vol_horario_escolhido FROM voluntarios WHERE id_relogio = ? ORDER BY vol_horario_escolhido', [latestClockId]);
        res.json(rows);
    } catch (error) {
        console.error('Erro ao buscar voluntários:', error);
        res.status(500).json({ error: 'Erro interno ao buscar voluntários' });
    }
});

// GET um por ID
app.get('/api/voluntarios/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const [rows] = await db.execute('SELECT id_voluntario, id_relogio, vol_nome_completo, vol_horario_escolhido FROM voluntarios WHERE id_voluntario = ?', [id]);
        if (rows.length === 0) {
            return res.status(404).json({ error: 'Voluntário não encontrado' });
        }
        res.json(rows[0]);
    } catch (error) {
        console.error('Erro ao buscar voluntário por ID:', error);
        res.status(500).json({ error: 'Erro interno ao buscar voluntário' });
    }
});

// POST (criar)
app.post('/api/voluntarios', async (req, res) => {
    try {
        const { vol_nome_completo, vol_horario_escolhido } = req.body;
        const [relogios] = await db.execute('SELECT id_relogio FROM relogio_oracao ORDER BY rel_data_relogio DESC LIMIT 1');
        if (relogios.length === 0) {
            return res.status(400).json({ error: 'Nenhum relógio de oração ativo para associar o voluntário.' });
        }
        const latestClockId = relogios[0].id_relogio;
        const horario = `${String(vol_horario_escolhido).padStart(2, '0')}:00:00`;

        const [result] = await db.execute(
            'INSERT INTO voluntarios (id_relogio, vol_nome_completo, vol_horario_escolhido) VALUES (?, ?, ?)',
            [latestClockId, vol_nome_completo, horario]
        );
        res.status(201).json({ id: result.insertId, ...req.body });
    } catch (error) {
        console.error('Erro ao adicionar voluntário:', error);
        res.status(500).json({ error: 'Erro interno ao adicionar voluntário' });
    }
});

// PUT (atualizar)
app.put('/api/voluntarios/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { vol_nome_completo, vol_horario_escolhido } = req.body;
        const horario = `${String(vol_horario_escolhido).padStart(2, '0')}:00:00`;
        await db.execute(
            'UPDATE voluntarios SET vol_nome_completo = ?, vol_horario_escolhido = ? WHERE id_voluntario = ?',
            [vol_nome_completo, horario, id]
        );
        res.json({ message: 'Voluntário atualizado com sucesso' });
    } catch (error) {
        console.error('Erro ao atualizar voluntário:', error);
        res.status(500).json({ error: 'Erro interno ao atualizar voluntário' });
    }
});

// DELETE
app.delete('/api/voluntarios/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await db.execute('DELETE FROM voluntarios WHERE id_voluntario = ?', [id]);
        res.status(204).send();
    } catch (error) {
        console.error('Erro ao deletar voluntário:', error);
        res.status(500).json({ error: 'Erro interno ao deletar voluntário' });
    }
});


// --- CRUD para Quadro Tito ---

// GET (Public): Retorna todos os post-its do quadro ativo no momento
app.get('/api/tito', async (req, res) => {
    try {
        // Junta as tabelas para pegar os post-its que pertencem a um quadro ativo
        const query = `
            SELECT p.id_postit, p.pst_conteudo 
            FROM post_it p
            JOIN quadro_tito q ON p.id_quadro = q.id_quadro
            WHERE CURDATE() BETWEEN q.qdt_data_inicial AND q.qdt_data_final
            ORDER BY p.id_postit DESC
        `;
        const [rows] = await db.execute(query);
        res.json(rows);
    } catch (error) {
        console.error('Erro ao buscar post-its do Quadro Tito:', error);
        res.status(500).json({ error: 'Erro interno ao buscar post-its' });
    }
});
// --- Endpoints de Admin para Quadros ---
app.get('/api/admin/quadros', async (req, res) => {
    try {
        const [rows] = await db.execute('SELECT id_quadro, qdt_titulo, qdt_data_inicial, qdt_data_final FROM quadro_tito ORDER BY qdt_data_criacao DESC');
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: 'Erro ao buscar quadros.' });
    }
});

app.get('/api/admin/quadros/:id', async (req, res) => {
    try {
        const [rows] = await db.execute('SELECT id_quadro, qdt_titulo, qdt_data_inicial, qdt_data_final FROM quadro_tito WHERE id_quadro = ?', [req.params.id]);
        res.json(rows[0]);
    } catch (error) {
        res.status(500).json({ error: 'Erro ao buscar quadro.' });
    }
});

app.post('/api/admin/quadros', async (req, res) => {
    try {
        const { qdt_titulo, qdt_data_inicial, qdt_data_final } = req.body;
        const [result] = await db.execute(
            'INSERT INTO quadro_tito (qdt_titulo, qdt_data_inicial, qdt_data_final, qdt_data_criacao) VALUES (?, ?, ?, NOW())',
            [qdt_titulo, qdt_data_inicial, qdt_data_final]
        );
        res.status(201).json({ id: result.insertId, ...req.body });
    } catch (error) {
        res.status(500).json({ error: 'Erro ao criar quadro.' });
    }
});

app.put('/api/admin/quadros/:id', async (req, res) => {
    try {
        const { qdt_titulo, qdt_data_inicial, qdt_data_final } = req.body;
        await db.execute(
            'UPDATE quadro_tito SET qdt_titulo = ?, qdt_data_inicial = ?, qdt_data_final = ? WHERE id_quadro = ?',
            [qdt_titulo, qdt_data_inicial, qdt_data_final, req.params.id]
        );
        res.json({ message: 'Quadro atualizado.' });
    } catch (error) {
        res.status(500).json({ error: 'Erro ao atualizar quadro.' });
    }
});

app.delete('/api/admin/quadros/:id', async (req, res) => {
    try {
        // Opcional: verificar se existem post-its antes de deletar
        await db.execute('DELETE FROM post_it WHERE id_quadro = ?', [req.params.id]); // Deleta os post-its associados
        await db.execute('DELETE FROM quadro_tito WHERE id_quadro = ?', [req.params.id]); // Deleta o quadro
        res.status(204).send();
    } catch (error) {
        res.status(500).json({ error: 'Erro ao deletar quadro.' });
    }
});

// --- Endpoints de Admin para Post-its ---
app.get('/api/admin/postits', async (req, res) => {
    try {
        const query = `
            SELECT p.id_postit, p.pst_conteudo, q.qdt_titulo, q.id_quadro
            FROM post_it p
            LEFT JOIN quadro_tito q ON p.id_quadro = q.id_quadro
            ORDER BY p.id_postit DESC
        `;
        const [rows] = await db.execute(query);
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: 'Erro ao buscar post-its.' });
    }
});

app.get('/api/admin/postits/:id', async (req, res) => {
    try {
        const [rows] = await db.execute('SELECT id_postit, pst_conteudo, id_quadro FROM post_it WHERE id_postit = ?', [req.params.id]);
        res.json(rows[0]);
    } catch (error) {
        res.status(500).json({ error: 'Erro ao buscar post-it.' });
    }
});

app.post('/api/admin/postits', async (req, res) => {
    try {
        const { pst_conteudo, id_quadro } = req.body;
        const [result] = await db.execute('INSERT INTO post_it (pst_conteudo, id_quadro) VALUES (?, ?)', [pst_conteudo, id_quadro]);
        res.status(201).json({ id: result.insertId, ...req.body });
    } catch (error) {
        res.status(500).json({ error: 'Erro ao criar post-it.' });
    }
});

app.put('/api/admin/postits/:id', async (req, res) => {
    try {
        const { pst_conteudo, id_quadro } = req.body;
        await db.execute('UPDATE post_it SET pst_conteudo = ?, id_quadro = ? WHERE id_postit = ?', [pst_conteudo, id_quadro, req.params.id]);
        res.json({ message: 'Post-it atualizado.' });
    } catch (error) {
        res.status(500).json({ error: 'Erro ao atualizar post-it.' });
    }
});

app.delete('/api/admin/postits/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await db.execute('DELETE FROM post_it WHERE id_postit = ?', [id]);
        res.status(204).send();
    } catch (error) {
        res.status(500).json({ error: 'Erro ao deletar post-it.' });
    }
});
// Endpoint para buscar dados do Relógio de Oração
app.get('/api/relogio', async (req, res) => {
    try {
        // 1. Busca o relógio mais recente (ou de hoje)
        const [relogios] = await db.execute('SELECT id_relogio, rel_data_relogio FROM relogio_oracao ORDER BY rel_data_relogio DESC LIMIT 1');
        
        if (relogios.length === 0) {
            return res.status(404).json({ message: 'Nenhum relógio de oração encontrado.' });
        }
        
        const relogio = relogios[0];
        
        // Verificação de segurança para evitar o erro "Bind parameters must not contain undefined"
        // Ajustado para usar 'id_relogio' conforme sua estrutura de banco
        if (!relogio || relogio.id_relogio === undefined) {
            console.error('Erro: Relógio encontrado mas sem id_relogio definido.', relogio);
            return res.status(500).json({ error: 'Inconsistência nos dados do relógio.' });
        }

        // 2. Busca voluntários vinculados a este relógio
        const [voluntarios] = await db.execute('SELECT vol_nome_completo, vol_horario_escolhido FROM voluntarios WHERE id_relogio = ?', [relogio.id_relogio]);

        // 3. Busca motivos de oração vinculados a este relógio
        const [motivos] = await db.execute('SELECT mot_descricao FROM motivos_oracao WHERE id_relogio = ?', [relogio.id_relogio]);

        res.json({ relogio, voluntarios, motivos });
    } catch (error) {
        console.error('Erro ao buscar relógio:', error);
        res.status(500).json({ error: 'Erro interno ao buscar dados do relógio' });
    }
});

app.listen(port, () => {
    console.log(`Servidor rodando em http://localhost:${port}`);
});
