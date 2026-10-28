const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { isAuthenticated } = require('../middleware/auth.middleware');
const { sendSseUpdate } = require('../services/sse.service');

/**
 * Normaliza strings de horário para o formato HH:MM:00
 */
function normalizeTime(input) {
    if (!input || input === 'todos' || input === 'geral') return null;
    const str = String(input).trim();
    if (!str) return null;
    const parts = str.split(':');
    const h = String(parseInt(parts[0], 10) || 0).padStart(2, '0');
    const m = String(parseInt(parts[1], 10) || 0).padStart(2, '0');
    return `${h}:${m}:00`;
}

// GET /api/relogio (Public) - Retorna o relógio ativo (disponível até 2h após a finalização)
router.get('/relogio', async (req, res) => {
    try {
        const [relogios] = await db.execute(
            `SELECT id_relogio, rel_titulo, rel_data_relogio,
                    (NOW() > TIMESTAMP(rel_data_relogio, '23:59:59')) as esta_finalizado
             FROM relogio_oracao 
             WHERE NOW() <= DATE_ADD(DATE_ADD(rel_data_relogio, INTERVAL 1 DAY), INTERVAL 2 HOUR)
             ORDER BY rel_data_relogio ASC 
             LIMIT 1`
        );
        
        if (relogios.length === 0) {
            return res.json({
                relogio: null,
                voluntarios: [],
                motivos: [],
                pendentes: [],
                message: 'Nenhum relógio de oração ativo no momento.'
            });
        }
        
        const relogio = relogios[0];
        relogio.esta_finalizado = Boolean(relogio.esta_finalizado);
        
        if (!relogio || relogio.id_relogio === undefined) {
            console.error('Erro: Relógio encontrado mas sem id_relogio definido.', relogio);
            return res.status(500).json({ error: 'Inconsistência nos dados do relógio.' });
        }

        const [voluntarios] = await db.execute(
            'SELECT id_voluntario, vol_nome_completo, vol_horario_escolhido FROM voluntarios WHERE id_relogio = ? ORDER BY vol_horario_escolhido',
            [relogio.id_relogio]
        );
        const [motivos] = await db.execute(
            'SELECT id_motivo, mot_descricao, mot_horario FROM motivos_oracao WHERE id_relogio = ? ORDER BY mot_horario, id_motivo',
            [relogio.id_relogio]
        );
        const [pendentes] = await db.execute(
            'SELECT DISTINCT sol_horario_escolhido FROM solicitacoes_oracao WHERE id_relogio = ? AND sol_status = "pendente"',
            [relogio.id_relogio]
        );

        res.json({ relogio, voluntarios, motivos, pendentes });
    } catch (error) {
        console.error('Erro ao buscar relógio:', error);
        res.status(500).json({ error: 'Erro interno ao buscar dados do relógio' });
    }
});

// --- Relógios (Admin) ---

// GET /api/relogios
router.get('/relogios', isAuthenticated, async (req, res) => {
    try {
        const [rows] = await db.execute('SELECT id_relogio, rel_titulo, rel_data_relogio FROM relogio_oracao ORDER BY rel_data_relogio DESC');
        res.json(rows);
    } catch (error) {
        console.error('Erro ao buscar relógios:', error);
        res.status(500).json({ error: 'Erro ao buscar relógios.' });
    }
});

// GET /api/relogios/:id
router.get('/relogios/:id', isAuthenticated, async (req, res) => {
    try {
        const { id } = req.params;
        const [rows] = await db.execute('SELECT id_relogio, rel_titulo, rel_data_relogio FROM relogio_oracao WHERE id_relogio = ?', [id]);
        if (rows.length === 0) {
            return res.status(404).json({ error: 'Relógio não encontrado.' });
        }
        res.json(rows[0]);
    } catch (error) {
        console.error('Erro ao buscar relógio por ID:', error);
        res.status(500).json({ error: 'Erro ao buscar relógio.' });
    }
});

// POST /api/relogios
router.post('/relogios', isAuthenticated, async (req, res) => {
    try {
        const { rel_titulo, rel_data_relogio } = req.body;
        const [result] = await db.execute(
            'INSERT INTO relogio_oracao (rel_titulo, rel_data_relogio) VALUES (?, ?)',
            [rel_titulo, rel_data_relogio]
        );
        res.status(201).json({ id: result.insertId, ...req.body });
    } catch (error) {
        console.error('Erro ao criar relógio:', error);
        res.status(500).json({ error: 'Erro ao criar relógio.' });
    }
});

// PUT /api/relogios/:id
router.put('/relogios/:id', isAuthenticated, async (req, res) => {
    try {
        const { id } = req.params;
        const { rel_titulo, rel_data_relogio } = req.body;
        await db.execute(
            'UPDATE relogio_oracao SET rel_titulo = ?, rel_data_relogio = ? WHERE id_relogio = ?',
            [rel_titulo, rel_data_relogio, id]
        );
        res.json({ message: 'Relógio atualizado com sucesso.' });
    } catch (error) {
        console.error('Erro ao atualizar relógio:', error);
        res.status(500).json({ error: 'Erro ao atualizar relógio.' });
    }
});

// DELETE /api/relogios/:id
router.delete('/relogios/:id', isAuthenticated, async (req, res) => {
    try {
        const { id } = req.params;
        await db.execute('DELETE FROM voluntarios WHERE id_relogio = ?', [id]);
        await db.execute('DELETE FROM motivos_oracao WHERE id_relogio = ?', [id]);
        await db.execute('DELETE FROM relogio_oracao WHERE id_relogio = ?', [id]);
        res.status(204).send();
    } catch (error) {
        console.error('Erro ao deletar relógio:', error);
        res.status(500).json({ error: 'Erro ao deletar relógio.' });
    }
});

// --- Voluntários ---

// GET /api/voluntarios
router.get('/voluntarios', isAuthenticated, async (req, res) => {
    try {
        const { relogioId } = req.query;
        if (!relogioId) {
            return res.json([]);
        }
        const [rows] = await db.execute('SELECT id_voluntario, vol_nome_completo, vol_horario_escolhido FROM voluntarios WHERE id_relogio = ? ORDER BY vol_horario_escolhido', [relogioId]);
        res.json(rows);
    } catch (error) {
        console.error('Erro ao buscar voluntários:', error);
        res.status(500).json({ error: 'Erro interno ao buscar voluntários' });
    }
});

// GET /api/voluntarios/:id
router.get('/voluntarios/:id', isAuthenticated, async (req, res) => {
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

// POST /api/voluntarios
router.post('/voluntarios', isAuthenticated, async (req, res) => {
    try {
        const { vol_nome_completo, vol_horario_escolhido, id_relogio } = req.body;
        if (!id_relogio) {
            return res.status(400).json({ error: 'É necessário especificar o relógio de oração para associar o voluntário.' });
        }
        const horario = normalizeTime(vol_horario_escolhido) || '00:00:00';
        const [result] = await db.execute(
            'INSERT INTO voluntarios (id_relogio, vol_nome_completo, vol_horario_escolhido) VALUES (?, ?, ?)',
            [id_relogio, vol_nome_completo, horario]
        );
        res.status(201).json({ id: result.insertId, ...req.body, vol_horario_escolhido: horario });
    } catch (error) {
        console.error('Erro ao adicionar voluntário:', error);
        res.status(500).json({ error: 'Erro interno ao adicionar voluntário' });
    }
});

// PUT /api/voluntarios/:id
router.put('/voluntarios/:id', isAuthenticated, async (req, res) => {
    try {
        const { id } = req.params;
        const { vol_nome_completo, vol_horario_escolhido } = req.body;
        const horario = normalizeTime(vol_horario_escolhido) || '00:00:00';
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

// DELETE /api/voluntarios/:id
router.delete('/voluntarios/:id', isAuthenticated, async (req, res) => {
    try {
        const { id } = req.params;
        await db.execute('DELETE FROM voluntarios WHERE id_voluntario = ?', [id]);
        res.status(204).send();
    } catch (error) {
        console.error('Erro ao deletar voluntário:', error);
        res.status(500).json({ error: 'Erro interno ao deletar voluntário' });
    }
});

// --- Motivos de Oração ---

// GET /api/motivos-oracao
router.get('/motivos-oracao', isAuthenticated, async (req, res) => {
    try {
        const { relogioId } = req.query;
        if (!relogioId) {
            return res.json([]);
        }
        const [rows] = await db.execute('SELECT id_motivo, mot_descricao, mot_horario, id_relogio FROM motivos_oracao WHERE id_relogio = ? ORDER BY mot_horario, id_motivo', [relogioId]);
        res.json(rows);
    } catch (error) {
        console.error('Erro ao buscar motivos de oração:', error);
        res.status(500).json({ error: 'Erro ao buscar motivos de oração.' });
    }
});

// GET /api/motivos-oracao/:id
router.get('/motivos-oracao/:id', isAuthenticated, async (req, res) => {
    try {
        const { id } = req.params;
        const [rows] = await db.execute('SELECT id_motivo, mot_descricao, mot_horario, id_relogio FROM motivos_oracao WHERE id_motivo = ?', [id]);
        if (rows.length === 0) {
            return res.status(404).json({ error: 'Motivo de oração não encontrado.' });
        }
        res.json(rows[0]);
    } catch (error) {
        console.error('Erro ao buscar motivo de oração por ID:', error);
        res.status(500).json({ error: 'Erro ao buscar motivo de oração.' });
    }
});

// POST /api/motivos-oracao
router.post('/motivos-oracao', isAuthenticated, async (req, res) => {
    try {
        const { mot_descricao, id_relogio, mot_horario } = req.body;
        if (!id_relogio || !mot_descricao) {
            return res.status(400).json({ error: 'Descrição e ID do relógio são obrigatórios.' });
        }
        const horario = normalizeTime(mot_horario);

        if (horario) {
            const [existentes] = await db.execute(
                'SELECT id_motivo FROM motivos_oracao WHERE id_relogio = ? AND mot_horario = ?',
                [id_relogio, horario]
            );
            if (existentes.length > 0) {
                return res.status(400).json({ error: 'Já existe um motivo de oração cadastrado para este ciclo de 15 minutos.' });
            }
        }

        const [result] = await db.execute(
            'INSERT INTO motivos_oracao (mot_descricao, id_relogio, mot_horario) VALUES (?, ?, ?)',
            [mot_descricao, id_relogio, horario]
        );
        res.status(201).json({ id: result.insertId, ...req.body, mot_horario: horario });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ error: 'Já existe um motivo de oração cadastrado para este ciclo de 15 minutos.' });
        }
        console.error('Erro ao criar motivo de oração:', error);
        res.status(500).json({ error: 'Erro ao criar motivo de oração.' });
    }
});

// PUT /api/motivos-oracao/:id
router.put('/motivos-oracao/:id', isAuthenticated, async (req, res) => {
    try {
        const { id } = req.params;
        const { mot_descricao, mot_horario, id_relogio } = req.body;
        const horario = normalizeTime(mot_horario);

        if (horario) {
            let relogioId = id_relogio;
            if (!relogioId) {
                const [atual] = await db.execute('SELECT id_relogio FROM motivos_oracao WHERE id_motivo = ?', [id]);
                if (atual.length > 0) relogioId = atual[0].id_relogio;
            }
            if (relogioId) {
                const [existentes] = await db.execute(
                    'SELECT id_motivo FROM motivos_oracao WHERE id_relogio = ? AND mot_horario = ? AND id_motivo != ?',
                    [relogioId, horario, id]
                );
                if (existentes.length > 0) {
                    return res.status(400).json({ error: 'Já existe outro motivo de oração cadastrado para este ciclo de 15 minutos.' });
                }
            }
        }

        await db.execute('UPDATE motivos_oracao SET mot_descricao = ?, mot_horario = ? WHERE id_motivo = ?', [mot_descricao, horario, id]);
        res.json({ message: 'Motivo de oração atualizado com sucesso.' });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ error: 'Já existe outro motivo de oração cadastrado para este ciclo de 15 minutos.' });
        }
        console.error('Erro ao atualizar motivo de oração:', error);
        res.status(500).json({ error: 'Erro ao atualizar motivo de oração.' });
    }
});

// DELETE /api/motivos-oracao/:id
router.delete('/motivos-oracao/:id', isAuthenticated, async (req, res) => {
    try {
        const { id } = req.params;
        await db.execute('DELETE FROM motivos_oracao WHERE id_motivo = ?', [id]);
        res.status(204).send();
    } catch (error) {
        console.error('Erro ao deletar motivo de oração:', error);
        res.status(500).json({ error: 'Erro ao deletar motivo de oração.' });
    }
});

// POST /api/relogios/:id/import-motivos (Admin)
// Importa motivos a partir de arquivo/texto (.TXT) e distribui aleatoriamente nos ciclos de 15 minutos
router.post('/relogios/:id/import-motivos', isAuthenticated, async (req, res) => {
    try {
        const { id } = req.params;
        const { text, motivos, replace = true } = req.body;

        // Verifica se o relógio existe
        const [relogioRows] = await db.execute('SELECT id_relogio, rel_titulo FROM relogio_oracao WHERE id_relogio = ?', [id]);
        if (relogioRows.length === 0) {
            return res.status(404).json({ error: 'Relógio de oração não encontrado.' });
        }

        // Extrai motivos de array ou de texto separado por quebra de linha
        let motivosList = [];
        if (Array.isArray(motivos)) {
            motivosList = motivos.map(m => String(m).trim()).filter(m => m.length > 0);
        } else if (typeof text === 'string') {
            motivosList = text.split(/\r?\n/).map(m => m.trim()).filter(m => m.length > 0);
        }

        if (motivosList.length === 0) {
            return res.status(400).json({ error: 'Nenhum motivo de oração válido encontrado. Envie um arquivo .TXT com pelo menos um motivo.' });
        }

        // Gera os 96 ciclos de 15 minutos em 24h (00:00:00 até 23:45:00)
        const allCycles = [];
        for (let h = 0; h < 24; h++) {
            for (let m = 0; m < 60; m += 15) {
                const hh = String(h).padStart(2, '0');
                const mm = String(m).padStart(2, '0');
                allCycles.push(`${hh}:${mm}:00`);
            }
        }

        let targetCycles = [];
        if (replace) {
            // Remove motivos existentes do relógio
            await db.execute('DELETE FROM motivos_oracao WHERE id_relogio = ?', [id]);
            targetCycles = [...allCycles];
        } else {
            // Busca ciclos já ocupados
            const [existing] = await db.execute('SELECT mot_horario FROM motivos_oracao WHERE id_relogio = ? AND mot_horario IS NOT NULL', [id]);
            const occupied = new Set(existing.map(e => e.mot_horario));
            targetCycles = allCycles.filter(c => !occupied.has(c));
            if (targetCycles.length === 0) {
                return res.status(400).json({ error: 'Todos os 96 ciclos de horário deste relógio já possuem motivos cadastrados.' });
            }
        }

        // Embaralhamento Fisher-Yates
        function shuffle(array) {
            const arr = [...array];
            for (let i = arr.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [arr[i], arr[j]] = [arr[j], arr[i]];
            }
            return arr;
        }

        // Embaralha tanto os ciclos disponíveis quanto os motivos recebidos
        const shuffledCycles = shuffle(targetCycles);
        const shuffledMotivos = shuffle(motivosList);

        // Mapeia os motivos para os ciclos sorteados
        const cycleMotivesMap = new Map();
        shuffledMotivos.forEach((motivo, index) => {
            const cycleTime = shuffledCycles[index % shuffledCycles.length];
            if (cycleMotivesMap.has(cycleTime)) {
                cycleMotivesMap.set(cycleTime, cycleMotivesMap.get(cycleTime) + '\n\n• ' + motivo);
            } else {
                cycleMotivesMap.set(cycleTime, motivo);
            }
        });

        // Insere no banco de dados
        for (const [horario, descricao] of cycleMotivesMap.entries()) {
            await db.execute(
                'INSERT INTO motivos_oracao (id_relogio, mot_horario, mot_descricao) VALUES (?, ?, ?)',
                [id, horario, descricao]
            );
        }

        // Notifica via Server-Sent Events para atualização em tempo real
        sendSseUpdate('relogio_update', { relogioId: id, action: 'import_motivos' });

        return res.json({
            success: true,
            totalMotivos: shuffledMotivos.length,
            ciclosPreenchidos: cycleMotivesMap.size,
            message: `${shuffledMotivos.length} motivos distribuídos aleatoriamente em ${cycleMotivesMap.size} ciclos de 15 minutos com sucesso!`
        });
    } catch (error) {
        console.error('Erro ao importar motivos de oração:', error);
        res.status(500).json({ error: 'Erro interno ao importar e distribuir motivos de oração.' });
    }
});

// ==========================================
// --- Solicitações de Voluntários de Oração ---
// ==========================================

// POST /api/relogio/solicitacao (Public)
router.post('/relogio/solicitacao', async (req, res) => {
    try {
        const fullName = (req.body.vol_nome_completo || req.body.nome_completo || '').trim();
        const rawHorario = req.body.vol_horario_escolhido || req.body.horario_escolhido;

        // Validação obrigatória de Nome e Sobrenome (pelo menos duas palavras)
        const nameParts = fullName.split(/\s+/).filter(p => p.length > 0);
        if (nameParts.length < 2 || nameParts.some(p => p.length < 2)) {
            return res.status(400).json({ error: 'É obrigatório informar seu nome e sobrenome.' });
        }

        // Validação do horário escolhido
        const horario = normalizeTime(rawHorario);
        if (!horario) {
            return res.status(400).json({ error: 'Por favor, selecione um horário válido para oração.' });
        }

        // Localiza o relógio de oração ativo (que ainda não expirou o prazo de 2h pós-finalização)
        const [relogios] = await db.execute(
            `SELECT id_relogio, rel_titulo, rel_data_relogio,
                    (NOW() > TIMESTAMP(rel_data_relogio, '23:59:59')) as esta_finalizado
             FROM relogio_oracao 
             WHERE NOW() <= DATE_ADD(DATE_ADD(rel_data_relogio, INTERVAL 1 DAY), INTERVAL 2 HOUR)
             ORDER BY rel_data_relogio ASC 
             LIMIT 1`
        );
        if (relogios.length === 0) {
            return res.status(404).json({ error: 'Nenhum relógio de oração ativo encontrado para receber voluntários.' });
        }
        const relogioAtivo = relogios[0];
        if (relogioAtivo.esta_finalizado) {
            return res.status(400).json({ error: 'Este relógio de oração já foi concluído e não está mais aceitando novos voluntários.' });
        }
        const id_relogio = relogioAtivo.id_relogio;

        // 1. Verifica se já existe voluntário confirmado para este horário
        const [volExistente] = await db.execute(
            'SELECT id_voluntario FROM voluntarios WHERE id_relogio = ? AND vol_horario_escolhido = ?',
            [id_relogio, horario]
        );
        if (volExistente.length > 0) {
            return res.status(400).json({ error: 'Este horário já possui um voluntário confirmado. Por favor, selecione outro horário disponível.' });
        }

        // 2. Verifica se já existe solicitação pendente (Em análise) para este horário
        const [solExistente] = await db.execute(
            'SELECT id_solicitacao FROM solicitacoes_oracao WHERE id_relogio = ? AND sol_horario_escolhido = ? AND sol_status = "pendente"',
            [id_relogio, horario]
        );
        if (solExistente.length > 0) {
            return res.status(400).json({ error: 'Este horário já possui uma solicitação em análise aguardando aprovação. Por favor, selecione outro horário disponível.' });
        }

        // Insere a solicitação
        const [result] = await db.execute(
            'INSERT INTO solicitacoes_oracao (id_relogio, sol_nome_completo, sol_horario_escolhido, sol_status, sol_data_criacao) VALUES (?, ?, ?, "pendente", NOW())',
            [id_relogio, fullName, horario]
        );

        // Notifica via SSE para atualização em tempo real no painel administrativo e telas públicas
        sendSseUpdate({ type: 'new_prayer_request' });
        sendSseUpdate({ type: 'prayer_clock_updated' });

        res.status(201).json({
            message: 'Sua solicitação de voluntário foi enviada com sucesso! O administrador irá analisar para confirmar seu horário.',
            id: result.insertId
        });
    } catch (error) {
        console.error('Erro ao enviar solicitação de voluntário:', error);
        res.status(500).json({ error: 'Erro interno ao processar sua solicitação.' });
    }
});

// GET /api/admin/solicitacoes-oracao (Admin) - Ordenado do mais antigo para o mais novo
router.get('/admin/solicitacoes-oracao', isAuthenticated, async (req, res) => {
    try {
        const [rows] = await db.execute(
            `SELECT 
                s.id_solicitacao, 
                s.id_relogio, 
                s.sol_nome_completo, 
                s.sol_horario_escolhido, 
                s.sol_status, 
                s.sol_data_criacao,
                r.rel_titulo,
                r.rel_data_relogio
             FROM solicitacoes_oracao s
             JOIN relogio_oracao r ON s.id_relogio = r.id_relogio
             WHERE s.sol_status = 'pendente'
             ORDER BY s.sol_data_criacao ASC`
        );
        res.json(rows);
    } catch (error) {
        console.error('Erro ao buscar solicitações pendentes de oração:', error);
        res.status(500).json({ error: 'Erro ao buscar solicitações de oração.' });
    }
});

// GET /api/admin/solicitacoes-oracao/historico (Admin)
router.get('/admin/solicitacoes-oracao/historico', isAuthenticated, async (req, res) => {
    try {
        const [rows] = await db.execute(
            `SELECT 
                s.id_solicitacao, 
                s.id_relogio, 
                s.sol_nome_completo, 
                s.sol_horario_escolhido, 
                s.sol_status, 
                s.sol_data_criacao,
                r.rel_titulo,
                r.rel_data_relogio
             FROM solicitacoes_oracao s
             JOIN relogio_oracao r ON s.id_relogio = r.id_relogio
             WHERE s.sol_status IN ('aprovado', 'recusado')
             ORDER BY s.sol_data_criacao DESC`
        );
        res.json(rows);
    } catch (error) {
        console.error('Erro ao buscar histórico de solicitações de oração:', error);
        res.status(500).json({ error: 'Erro ao buscar histórico de solicitações.' });
    }
});

// POST /api/admin/solicitacoes-oracao/:id/aprovar (Admin)
router.post('/admin/solicitacoes-oracao/:id/aprovar', isAuthenticated, async (req, res) => {
    const solicitacaoId = req.params.id;
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        const [solicitacoes] = await connection.execute(
            'SELECT id_solicitacao, id_relogio, sol_nome_completo, sol_horario_escolhido FROM solicitacoes_oracao WHERE id_solicitacao = ? AND sol_status = "pendente"',
            [solicitacaoId]
        );

        if (solicitacoes.length === 0) {
            throw new Error('Solicitação não encontrada ou já processada.');
        }

        const sol = solicitacoes[0];

        // Insere o voluntário no relógio de oração
        await connection.execute(
            'INSERT INTO voluntarios (id_relogio, vol_nome_completo, vol_horario_escolhido) VALUES (?, ?, ?)',
            [sol.id_relogio, sol.sol_nome_completo, sol.sol_horario_escolhido]
        );

        // Atualiza a solicitação para aprovada
        await connection.execute(
            'UPDATE solicitacoes_oracao SET sol_status = "aprovado" WHERE id_solicitacao = ?',
            [solicitacaoId]
        );

        await connection.commit();

        // Notifica clientes conectados para atualização em tempo real
        sendSseUpdate({ type: 'prayer_clock_updated' });

        res.json({ message: 'Solicitação aceita com sucesso! O voluntário foi vinculado ao relógio de oração.' });
    } catch (error) {
        await connection.rollback();
        console.error('Erro ao aprovar solicitação de voluntário:', error);
        res.status(500).json({ error: error.message || 'Erro interno ao aprovar solicitação.' });
    } finally {
        connection.release();
    }
});

// POST /api/admin/solicitacoes-oracao/:id/recusar (Admin)
router.post('/admin/solicitacoes-oracao/:id/recusar', isAuthenticated, async (req, res) => {
    try {
        const solicitacaoId = req.params.id;
        await db.execute(
            'UPDATE solicitacoes_oracao SET sol_status = "recusado" WHERE id_solicitacao = ?',
            [solicitacaoId]
        );
        sendSseUpdate({ type: 'prayer_clock_updated' });
        res.json({ message: 'Solicitação recusada com sucesso.' });
    } catch (error) {
        console.error('Erro ao recusar solicitação de voluntário:', error);
        res.status(500).json({ error: 'Erro interno ao recusar solicitação.' });
    }
});

module.exports = router;
