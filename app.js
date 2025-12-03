// Sistema de Gestão de Peças - MSL2

// ==================== SISTEMA DE AUTENTICAÇÃO ====================
const CURRENT_ORIGIN = window.location.origin || 'http://localhost';
const API_BASE_URL = window.API_BASE_URL
    || (CURRENT_ORIGIN.includes(':2021') ? CURRENT_ORIGIN.replace(':2021', ':2020') : CURRENT_ORIGIN);
let authDisabled = false; // Será sincronizado com o backend via /health
const DEFAULT_ADMIN_USER = {
    id: 0,
    username: 'dev-admin',
    nome: 'Administrador (modo teste)',
    role: 'master'
};
const DEFAULT_ADMIN_TOKEN = 'dev-mode-token';

// Estado da aplicação sincronizado com o backend
let authToken = localStorage.getItem('msl_token') || null;
let usuarioAtual = JSON.parse(localStorage.getItem('msl_usuario') || 'null');
let authErrorNotified = false;
let usuarios = [];
let pecas = [];
let clientes = [];
let clienteIdMap = {};
let secretarias = {};
let secretariaIdMap = {};
let tiposPeca = [];
let tipoPecaIdMap = {};

// Definições de permissões
const permissoes = {
    master: {
        nome: 'Master',
        descricao: 'Acesso total ao sistema, relatórios e gráficos',
        podeInserir: true,
        podeEditar: true,
        podeDeletar: true,
        podeRelatorio: true,
        podeAdmin: true,
        podeConfig: true
    },
    social_media: {
        nome: 'Social Media',
        descricao: 'Pode inserir material e editar nomes e datas',
        podeInserir: true,
        podeEditar: true,
        podeDeletar: false,
        podeRelatorio: false,
        podeAdmin: false,
        podeConfig: false
    },
    financeiro: {
        nome: 'Financeiro',
        descricao: 'Pode editar o que está feito e gerar relatório',
        podeInserir: false,
        podeEditar: true,
        podeDeletar: false,
        podeRelatorio: true,
        podeAdmin: false,
        podeConfig: false
    }
};

function setAuthData(token, user) {
    authToken = token;
    usuarioAtual = user;
    authErrorNotified = false;
    if (token && user) {
        localStorage.setItem('msl_token', token);
        localStorage.setItem('msl_usuario', JSON.stringify(user));
    } else {
        localStorage.removeItem('msl_token');
        localStorage.removeItem('msl_usuario');
    }
}

function aplicarModoAutenticacao() {
    if (authDisabled) {
        setAuthData(DEFAULT_ADMIN_TOKEN, DEFAULT_ADMIN_USER);
    } else if (authToken === DEFAULT_ADMIN_TOKEN) {
        setAuthData(null, null);
    }
}

async function sincronizarModoAutenticacao() {
    try {
        const status = await apiRequest('/health', { auth: false });
        authDisabled = Boolean(status && status.authDisabled);
        aplicarModoAutenticacao();
    } catch (error) {
        console.warn('Não foi possível verificar o modo de autenticação.', error);
    }
}

async function apiRequest(path, { method = 'GET', body, headers = {}, params, auth = true } = {}) {
    const base = API_BASE_URL || window.location.origin;
    const url = new URL(path, base.endsWith('/') ? base : `${base}/`);
    if (params) {
        Object.entries(params).forEach(([key, value]) => {
            if (value !== undefined && value !== null && value !== '') {
                url.searchParams.append(key, value);
            }
        });
    }

    const config = {
        method,
        headers: {
            'Content-Type': 'application/json',
            ...headers,
        },
    };

    if (body) {
        config.body = JSON.stringify(body);
    } else if (method === 'GET') {
        delete config.headers['Content-Type'];
    }

    if (auth && authToken) {
        config.headers.Authorization = `Bearer ${authToken}`;
    }

    let response;
    try {
        response = await fetch(url.toString(), config);
    } catch (error) {
        throw new Error('Não foi possível conectar ao servidor.');
    }
    if (!response.ok) {
        let detail = response.statusText;
        const isUnauthorized = response.status === 401;
        try {
            const data = await response.json();
            detail = data.detail || data.message || JSON.stringify(data);
        } catch {
            // Ignora parse de erro
        }
        if (isUnauthorized && !authDisabled) {
            setAuthData(null, null);
            if (!authErrorNotified) {
                authErrorNotified = true;
                atualizarInterfaceUsuario();
                abrirLogin();
                detail = 'Sessão expirada. Faça login novamente.';
            }
        }
        const error = new Error(detail || 'Erro ao comunicar com o servidor.');
        error.status = response.status;
        throw error;
    }

    if (response.status === 204) {
        return null;
    }

    try {
        return await response.json();
    } catch {
        return null;
    }
}

async function carregarClientes() {
    const data = await apiRequest('/api/clientes');
    clientes = data.map(cliente => cliente.nome);
    clienteIdMap = {};
    data.forEach(cliente => {
        clienteIdMap[cliente.nome] = cliente.id;
    });
}

async function carregarSecretariasDoCliente(nome) {
    const clienteId = clienteIdMap[nome];
    if (!clienteId) {
        return;
    }
    const data = await apiRequest(`/api/clientes/${clienteId}/secretarias`);
    secretarias[nome] = data.map(sec => sec.nome);
    data.forEach(sec => {
        secretariaIdMap[`${nome}::${sec.nome}`] = sec.id;
    });
}

async function carregarSecretarias() {
    secretarias = {};
    secretariaIdMap = {};
    await Promise.all(clientes.map((nome) => carregarSecretariasDoCliente(nome)));
}

async function carregarTiposPeca() {
    const data = await apiRequest('/api/tipos-peca');
    tiposPeca = data.map(tipo => tipo.nome);
    tipoPecaIdMap = {};
    data.forEach(tipo => {
        tipoPecaIdMap[tipo.nome] = tipo.id;
    });
}

async function carregarDadosBase() {
    if (!authToken) {
        return;
    }
    await carregarClientes();
    await carregarSecretarias();
    await carregarTiposPeca();
    atualizarDropdowns();
    renderizarClientes();
    renderizarSecretarias();
    renderizarTiposPeca();
}


// Elementos do DOM
const tabs = document.querySelectorAll('.tab-btn');
const tabContents = document.querySelectorAll('.tab-content');
const formCadastro = document.getElementById('form-cadastro');
const formRelatorio = document.getElementById('form-relatorio');
const fileInput = document.getElementById('comprovacao');
const previewImage = document.getElementById('preview-image');
const filePreview = document.querySelector('.file-preview');
const filePlaceholder = document.querySelector('.file-upload-placeholder');
const removeFileBtn = document.querySelector('.remove-file');
const modal = document.getElementById('modal-comprovacao');
const modalImage = document.getElementById('modal-image');
const modalClose = document.querySelector('.modal-close');

// ==================== NAVEGAÇÃO ENTRE ABAS ====================
tabs.forEach(tab => {
    tab.addEventListener('click', () => {
        const targetTab = tab.dataset.tab;

        // Remove active de todas as tabs
        tabs.forEach(t => t.classList.remove('active'));
        tabContents.forEach(tc => tc.classList.remove('active'));

        // Adiciona active na tab clicada
        tab.classList.add('active');
        document.getElementById(targetTab).classList.add('active');

        // Atualiza listagem se for a aba de listagem
        if (targetTab === 'listagem') {
            renderizarPecas();
        }
    });
});

// ==================== UPLOAD DE ARQUIVO ====================
let arquivoSelecionado = null;

fileInput.addEventListener('change', function(e) {
    const file = e.target.files[0];

    if (file) {
        if (!file.type.startsWith('image/')) {
            showMessage('Por favor, selecione apenas arquivos de imagem!', 'error');
            return;
        }

        arquivoSelecionado = file;
        const reader = new FileReader();

        reader.onload = function(e) {
            previewImage.src = e.target.result;
            filePlaceholder.style.display = 'none';
            filePreview.style.display = 'block';
        };

        reader.readAsDataURL(file);
    }
});

removeFileBtn.addEventListener('click', function() {
    fileInput.value = '';
    arquivoSelecionado = null;
    filePlaceholder.style.display = 'block';
    filePreview.style.display = 'none';
    previewImage.src = '';
});

// ==================== CADASTRO DE PEÇA ====================
formCadastro.addEventListener('submit', async function(e) {
    e.preventDefault();

    // Verificar permissão
    if (!verificarPermissao('inserir')) {
        return;
    }

    // Validação
    if (!arquivoSelecionado) {
        showMessage('Por favor, adicione a comprovação (print)!', 'error');
        return;
    }

    // Validação de tamanho do arquivo (5MB)
    if (arquivoSelecionado.size > 5 * 1024 * 1024) {
        showMessage('O arquivo deve ter no máximo 5MB!', 'error');
        return;
    }

    // Captura dos dados
    const novaPeca = {
        cliente: document.getElementById('cliente').value,
        secretaria: document.getElementById('secretaria').value,
        tipoPeca: document.getElementById('tipo-peca').value,
        nomePeca: document.getElementById('nome-peca').value,
        dataCriacao: document.getElementById('data-criacao').value,
        dataVeiculacao: document.getElementById('data-veiculacao').value || null,
        observacao: document.getElementById('observacao').value || '',
        comprovacao: previewImage.src
    };

    try {
        await apiRequest('/api/pecas', { method: 'POST', body: novaPeca });
        await renderizarPecas();

        formCadastro.reset();
        fileInput.value = '';
        arquivoSelecionado = null;
        filePlaceholder.style.display = 'block';
        filePreview.style.display = 'none';
        previewImage.src = '';

        showMessage('Peça cadastrada com sucesso!', 'success');
    } catch (error) {
        showMessage(error.message || 'Erro ao cadastrar peça.', 'error');
    }
});

// ==================== GERAÇÃO DE RELATÓRIO ====================
formRelatorio.addEventListener('submit', async function(e) {
    e.preventDefault();

    // Verificar permissão
    if (!verificarPermissao('relatorio')) {
        return;
    }

    const cliente = document.getElementById('rel-cliente').value;
    const secretaria = document.getElementById('rel-secretaria').value;
    const dataInicio = document.getElementById('rel-data-inicio').value;
    const dataFim = document.getElementById('rel-data-fim').value;

    // Validação de datas
    if (new Date(dataInicio) > new Date(dataFim)) {
        showMessage('A data de início não pode ser maior que a data fim!', 'error');
        return;
    }
    try {
        const relatorio = await apiRequest('/api/relatorios/pecas', {
            params: {
                cliente,
                secretaria,
                dataInicio,
                dataFim,
            },
        });

        if (!relatorio || !relatorio.linhas || relatorio.linhas.length === 0) {
            showMessage('Nenhuma peça encontrada com os filtros selecionados!', 'error');
            return;
        }

        renderizarRelatorio(relatorio);
    } catch (error) {
        showMessage(error.message || 'Erro ao gerar relatório.', 'error');
    }
});

function renderizarRelatorio(relatorio) {
    const resultadoDiv = document.getElementById('resultado-relatorio');
    const tabelaBody = document.getElementById('tabela-relatorio');
    const { info, stats, linhas } = relatorio;

    // Armazena o relatório para exportação em PDF
    ultimoRelatorioGerado = relatorio;

    // Atualiza informações do cabeçalho
    document.getElementById('info-cliente').textContent = info.cliente || 'Todos os clientes';
    document.getElementById('info-secretaria').textContent = info.secretaria || 'Todas as secretarias';
    const periodo = info.dataInicio && info.dataFim
        ? `${formatarData(info.dataInicio)} até ${formatarData(info.dataFim)}`
        : '-';
    document.getElementById('info-periodo').textContent = periodo;

    // Atualiza estatísticas
    document.getElementById('stat-total').textContent = stats.totalPecas;
    document.getElementById('stat-secretarias').textContent = stats.totalSecretarias;

    // Limpa tabela
    tabelaBody.innerHTML = '';

    // Preenche tabela
    linhas.forEach(item => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${escapeHTML(item.secretaria)}</strong></td>
            <td>${escapeHTML(item.tipoPeca)}</td>
            <td>${escapeHTML(item.nomePeca)}</td>
            <td>${formatarData(item.dataCriacao)}</td>
            <td>${item.dataVeiculacao ? formatarData(item.dataVeiculacao) : '-'}</td>
            <td><span style="background: #10b981; color: white; padding: 0.25rem 0.75rem; border-radius: 999px; font-weight: 600;">${item.quantidade}</span></td>
        `;
        tabelaBody.appendChild(tr);
    });

    // Mostra resultado
    resultadoDiv.style.display = 'block';
    resultadoDiv.scrollIntoView({ behavior: 'smooth' });
}

// ==================== LISTAGEM DE PEÇAS ====================
let viewMode = 'grid'; // 'grid' ou 'list'
let ultimoRelatorioGerado = null; // Armazena dados do último relatório para exportação PDF

async function renderizarPecas() {
    const listaPecas = document.getElementById('lista-pecas');
    const emptyState = document.getElementById('empty-state');

    if (!authToken) {
        listaPecas.style.display = 'none';
        emptyState.style.display = 'block';
        emptyState.querySelector('h3').textContent = 'Faça login para visualizar as peças';
        emptyState.querySelector('p').textContent = 'Clique no avatar no canto superior e entre com seu usuário.';
        return;
    }

    listaPecas.className = viewMode === 'grid' ? 'pecas-grid' : 'pecas-list';
    listaPecas.style.display = viewMode === 'grid' ? 'grid' : 'flex';
    listaPecas.innerHTML = '<p style="grid-column: 1 / -1; text-align:center;">Carregando peças...</p>';
    emptyState.style.display = 'none';

    const filterCliente = document.getElementById('filter-cliente').value;
    const filterSecretaria = document.getElementById('filter-secretaria').value;
    const filterTipo = document.getElementById('filter-tipo').value;
    const filterDataInicio = document.getElementById('filter-data-inicio').value;
    const filterDataFim = document.getElementById('filter-data-fim').value;

    try {
        const data = await apiRequest('/api/pecas', {
            params: {
                cliente: filterCliente,
                secretaria: filterSecretaria,
                tipoPeca: filterTipo,
                dataInicio: filterDataInicio,
                dataFim: filterDataFim,
            },
        });
        pecas = data || [];

        if (pecas.length === 0) {
            listaPecas.style.display = 'none';
            emptyState.style.display = 'block';
            emptyState.querySelector('h3').textContent = 'Nenhuma peça encontrada';
            emptyState.querySelector('p').textContent = 'Tente ajustar os filtros de busca';
            return;
        }

        listaPecas.innerHTML = '';
        pecas.sort((a, b) => new Date(b.dataCadastro) - new Date(a.dataCadastro));

        pecas.forEach(peca => {
            const card = document.createElement('div');
            card.className = 'peca-card';
            card.innerHTML = `
                <div class="peca-card-header">
                    <div class="peca-card-title">
                        <span class="peca-badge">${escapeHTML(peca.tipoPeca)}</span>
                        <h3>${escapeHTML(peca.nomePeca)}</h3>
                    </div>
                </div>
                <div class="peca-card-body">
                    <div class="peca-info">
                        <div class="peca-info-item">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                                <circle cx="12" cy="7" r="4"/>
                            </svg>
                            <strong>Cliente:</strong>
                            <span>${escapeHTML(peca.cliente)}</span>
                        </div>
                        <div class="peca-info-item">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                                <polyline points="9 22 9 12 15 12 15 22"/>
                            </svg>
                            <strong>Secretaria:</strong>
                            <span>${escapeHTML(peca.secretaria)}</span>
                        </div>
                        <div class="peca-info-item">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                                <line x1="16" y1="2" x2="16" y2="6"/>
                                <line x1="8" y1="2" x2="8" y2="6"/>
                                <line x1="3" y1="10" x2="21" y2="10"/>
                            </svg>
                            <strong>Criação:</strong>
                            <span>${formatarData(peca.dataCriacao)}</span>
                        </div>
                        ${peca.dataVeiculacao ? `
                        <div class="peca-info-item">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <circle cx="12" cy="12" r="10"/>
                                <polyline points="12 6 12 12 16 14"/>
                            </svg>
                            <strong>Veiculação:</strong>
                            <span>${formatarData(peca.dataVeiculacao)}</span>
                        </div>
                        ` : ''}
                        ${peca.observacao ? `
                        <div class="peca-info-item" style="grid-column: 1 / -1; margin-top: 0.5rem; padding-top: 0.5rem; border-top: 1px solid var(--border-color);">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                                <polyline points="14 2 14 8 20 8"/>
                                <line x1="16" y1="13" x2="8" y2="13"/>
                                <line x1="16" y1="17" x2="8" y2="17"/>
                            </svg>
                            <strong>Observação:</strong>
                            <span style="flex: 1;">${escapeHTML(peca.observacao)}</span>
                        </div>
                        ` : ''}
                    </div>
                </div>
                <div class="peca-card-footer">
                    <button class="btn-small btn-view" onclick="visualizarComprovacao(${peca.id})">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                            <circle cx="12" cy="12" r="3"/>
                        </svg>
                        Ver Comprovação
                    </button>
                    <button class="btn-small btn-edit" onclick="editarPeca(${peca.id})">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                        </svg>
                        Editar
                    </button>
                    <button class="btn-small btn-delete" onclick="deletarPeca(${peca.id})">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="3 6 5 6 21 6"/>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                        </svg>
                        Excluir
                    </button>
                </div>
            `;
            listaPecas.appendChild(card);
        });
    } catch (error) {
        listaPecas.style.display = 'none';
        emptyState.style.display = 'block';
        emptyState.querySelector('h3').textContent = 'Erro ao carregar peças';
        emptyState.querySelector('p').textContent = error.message || 'Tente novamente mais tarde.';
        showMessage(error.message || 'Erro ao carregar peças.', 'error');
    }
}

// Event listeners para filtros
document.getElementById('filter-cliente').addEventListener('change', function() {
    const clienteSelecionado = this.value;
    const filterSecretariaSelect = document.getElementById('filter-secretaria');

    // Atualiza dropdown de secretarias baseado no cliente selecionado
    filterSecretariaSelect.innerHTML = '<option value="">Todas as secretarias</option>';

    if (clienteSelecionado && secretarias[clienteSelecionado]) {
        secretarias[clienteSelecionado].forEach(secretaria => {
            const safeSec = escapeHTML(secretaria);
            filterSecretariaSelect.innerHTML += `<option value="${safeSec}">${safeSec}</option>`;
        });
    } else if (!clienteSelecionado) {
        // Se não houver cliente selecionado, mostra todas as secretarias
        const todasSecretarias = new Set();
        Object.values(secretarias).forEach(secs => {
            secs.forEach(sec => todasSecretarias.add(sec));
        });
        todasSecretarias.forEach(secretaria => {
            const safeSec = escapeHTML(secretaria);
            filterSecretariaSelect.innerHTML += `<option value="${safeSec}">${safeSec}</option>`;
        });
    }

    renderizarPecas();
});

document.getElementById('filter-secretaria').addEventListener('change', renderizarPecas);
document.getElementById('filter-tipo').addEventListener('change', renderizarPecas);
document.getElementById('filter-data-inicio').addEventListener('change', renderizarPecas);
document.getElementById('filter-data-fim').addEventListener('change', renderizarPecas);

// Botão limpar filtros
document.getElementById('btn-limpar-filtros').addEventListener('click', function() {
    document.getElementById('filter-cliente').value = '';
    document.getElementById('filter-secretaria').value = '';
    document.getElementById('filter-tipo').value = '';
    document.getElementById('filter-data-inicio').value = '';
    document.getElementById('filter-data-fim').value = '';

    // Restaura todas as secretarias no dropdown
    const filterSecretariaSelect = document.getElementById('filter-secretaria');
    filterSecretariaSelect.innerHTML = '<option value="">Todas as secretarias</option>';
    const todasSecretarias = new Set();
    Object.values(secretarias).forEach(secs => {
        secs.forEach(sec => todasSecretarias.add(sec));
    });
    todasSecretarias.forEach(secretaria => {
        filterSecretariaSelect.innerHTML += `<option value="${secretaria}">${secretaria}</option>`;
    });

    renderizarPecas();
});

// Event listeners para alternância de visualização
document.getElementById('btn-view-grid').addEventListener('click', function() {
    viewMode = 'grid';
    document.getElementById('btn-view-grid').classList.add('active');
    document.getElementById('btn-view-list').classList.remove('active');
    renderizarPecas();
});

document.getElementById('btn-view-list').addEventListener('click', function() {
    viewMode = 'list';
    document.getElementById('btn-view-list').classList.add('active');
    document.getElementById('btn-view-grid').classList.remove('active');
    renderizarPecas();
});

// ==================== FUNÇÕES AUXILIARES ====================
function escapeHTML(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

async function visualizarComprovacao(id) {
    try {
        const pecaDetalhe = await apiRequest(`/api/pecas/${id}`);
        if (pecaDetalhe && pecaDetalhe.comprovacao) {
            modalImage.src = pecaDetalhe.comprovacao;
            modal.classList.add('active');
        } else {
            showMessage('Comprovação não encontrada.', 'error');
        }
    } catch (error) {
        showMessage(error.message || 'Erro ao carregar comprovação.', 'error');
    }
}

async function deletarPeca(id) {
    if (!verificarPermissao('deletar')) {
        return;
    }

    if (confirm('Tem certeza que deseja excluir esta peça?')) {
        try {
            await apiRequest(`/api/pecas/${id}`, { method: 'DELETE' });
            await renderizarPecas();
            showMessage('Peça excluída com sucesso!', 'success');
        } catch (error) {
            showMessage(error.message || 'Erro ao excluir peça.', 'error');
        }
    }
}

function formatarData(dataString) {
    if (!dataString) {
        return '-';
    }
    const data = new Date(dataString.includes('T') ? dataString : `${dataString}T00:00:00`);
    return data.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });
}

function showMessage(message, type = 'success') {
    const div = document.createElement('div');
    div.className = 'success-message';
    div.style.background = type === 'success' ? '#10b981' : '#ef4444';
    const svgWrapper = document.createElement('div');
    svgWrapper.innerHTML = `
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            ${type === 'success'
                ? '<polyline points="20 6 9 17 4 12"></polyline>'
                : '<circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line>'
            }
        </svg>
    `;
    const svg = svgWrapper.firstElementChild;
    if (svg) {
        div.appendChild(svg);
    }
    const textSpan = document.createElement('span');
    textSpan.textContent = message;
    div.appendChild(textSpan);

    document.body.appendChild(div);

    setTimeout(() => {
        div.remove();
    }, 3000);
}

// ==================== MODAL ====================
modalClose.addEventListener('click', () => {
    modal.classList.remove('active');
});

modal.addEventListener('click', (e) => {
    if (e.target === modal) {
        modal.classList.remove('active');
    }
});

// ==================== EXPORTAR RELATÓRIO ====================
async function gerarPDF() {
    const { jsPDF } = window.jspdf;

    if (!jsPDF) {
        showMessage('Erro ao carregar biblioteca de PDF. Recarregue a página.', 'error');
        return;
    }

    // Verifica se há um relatório gerado
    if (!ultimoRelatorioGerado) {
        showMessage('Gere um relatório primeiro antes de exportar!', 'error');
        return;
    }

    const { info, stats, linhas } = ultimoRelatorioGerado;

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 20;

    // ===== CABEÇALHO COM CORES E LOGO =====
    // Faixa preta diagonal (canto superior esquerdo)
    doc.setFillColor(0, 0, 0);
    doc.triangle(0, 0, 70, 0, 0, 35, 'F');

    // Faixa turquesa diagonal
    doc.setFillColor(64, 190, 175);
    doc.triangle(70, 0, pageWidth, 0, pageWidth, 50, 'F');
    doc.triangle(70, 0, 0, 35, pageWidth, 50, 'F');

    // Logo/Texto MSL ESTRATÉGIA (canto superior direito)
    doc.setFontSize(12);
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.text('MSL ESTRATÉGIA', pageWidth - 15, 10, { align: 'right' });
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text('COMUNICAÇÃO & MARKETING', pageWidth - 15, 15, { align: 'right' });

    // Título principal
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    const clienteNome = info.cliente || 'TODOS OS CLIENTES';
    doc.text('ATIVIDADES DA PREFEITURA', pageWidth / 2, 23, { align: 'center' });
    doc.text(`DE ${clienteNome.toUpperCase()}`, pageWidth / 2, 30, { align: 'center' });

    // Período
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    const mes = info.dataInicio && info.dataFim
        ? obterMesAno(info.dataInicio, info.dataFim)
        : 'PERÍODO NÃO ESPECIFICADO';
    doc.text(`NO MÊS DE ${mes}`, pageWidth / 2, 37, { align: 'center' });

    // ===== CORPO DO RELATÓRIO =====
    let yPos = 60;
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(10);

    // Agrupa peças por secretaria
    const pecasPorSecretaria = agruparPorSecretaria(linhas);

    // Itera sobre cada secretaria
    for (const [secretaria, pecas] of Object.entries(pecasPorSecretaria)) {
        // Verifica se precisa de nova página
        if (yPos > pageHeight - 40) {
            doc.addPage();
            yPos = 20;
        }

        // Título da secretaria com total de peças
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.text(`${secretaria.toUpperCase()} - ${pecas.length} PEÇAS`, margin, yPos);
        yPos += 7;

        // Lista numerada de peças
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);

        pecas.forEach((peca, index) => {
            // Verifica se precisa de nova página
            if (yPos > pageHeight - 20) {
                doc.addPage();
                yPos = 20;
            }

            // Número da peça
            const numero = `${index + 1}`;
            doc.setFont('helvetica', 'bold');
            doc.text(numero, margin + 2, yPos);

            // Nome da peça (quebra linha se necessário)
            doc.setFont('helvetica', 'normal');
            const nomePeca = peca.nomePeca || 'Sem nome';
            const linhasTexto = doc.splitTextToSize(nomePeca, pageWidth - margin - 25);
            doc.text(linhasTexto, margin + 8, yPos);

            yPos += Math.max(5, linhasTexto.length * 4.5);
        });

        yPos += 5; // Espaço entre secretarias
    }

    // ===== RODAPÉ =====
    const totalPecas = stats.totalPecas || 0;
    const totalSecretarias = stats.totalSecretarias || 0;

    // Linha antes do rodapé
    if (yPos < pageHeight - 30) {
        doc.setDrawColor(200, 200, 200);
        doc.line(margin, yPos, pageWidth - margin, yPos);
        yPos += 8;
    } else {
        doc.addPage();
        yPos = 20;
    }

    // Totais
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text(`TOTAL: ${totalPecas} peças cadastradas em ${totalSecretarias} secretaria(s)`, margin, yPos);

    // Data de geração
    const rodapeY = pageHeight - 10;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    const dataGeracao = new Date().toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
    doc.text(`Relatório gerado em ${dataGeracao}`, margin, rodapeY);
    doc.text('SIGEPRE - Sistema MSL Estratégia', pageWidth - margin, rodapeY, { align: 'right' });

    // ===== SALVAR PDF =====
    const clienteArquivo = (info.cliente || 'Todos').replace(/\s+/g, '_');
    const nomeArquivo = `GJ_RELATORIO_${clienteArquivo}_${new Date().toISOString().split('T')[0]}.pdf`;
    doc.save(nomeArquivo);

    showMessage('Relatório PDF gerado com sucesso!', 'success');
}

// Função auxiliar para agrupar peças por secretaria
function agruparPorSecretaria(linhas) {
    const grupos = {};

    if (!linhas || linhas.length === 0) {
        return grupos;
    }

    linhas.forEach(linha => {
        const secretaria = linha.secretaria || 'Sem Secretaria';
        if (!grupos[secretaria]) {
            grupos[secretaria] = [];
        }
        grupos[secretaria].push(linha);
    });

    return grupos;
}

// Função auxiliar para obter mês e ano do período
function obterMesAno(dataInicio, dataFim) {
    if (!dataInicio) return 'NÃO ESPECIFICADO';

    const meses = [
        'JANEIRO', 'FEVEREIRO', 'MARÇO', 'ABRIL', 'MAIO', 'JUNHO',
        'JULHO', 'AGOSTO', 'SETEMBRO', 'OUTUBRO', 'NOVEMBRO', 'DEZEMBRO'
    ];

    const data = new Date(dataInicio + 'T00:00:00');
    const mes = meses[data.getMonth()];

    return `${mes}`;
}

document.getElementById('btn-exportar').addEventListener('click', function() {
    gerarPDF();
});

// ==================== CONFIGURAÇÃO ====================
async function atualizarConfiguracoesUI() {
    await carregarDadosBase();
}

function atualizarDropdowns() {
    // Atualiza dropdown de clientes no cadastro
    const clienteSelect = document.getElementById('cliente');
    clienteSelect.innerHTML = '<option value="">Selecione um cliente</option>';
    clientes.forEach(cliente => {
        const safe = escapeHTML(cliente);
        clienteSelect.innerHTML += `<option value="${safe}">${safe}</option>`;
    });

    // Atualiza dropdown de clientes no relatório
    const relClienteSelect = document.getElementById('rel-cliente');
    relClienteSelect.innerHTML = '<option value="">Todos os clientes</option>';
    clientes.forEach(cliente => {
        const safe = escapeHTML(cliente);
        relClienteSelect.innerHTML += `<option value="${safe}">${safe}</option>`;
    });

    // Atualiza dropdown de clientes na configuração de secretarias
    const secClienteSelect = document.getElementById('secretaria-cliente');
    secClienteSelect.innerHTML = '<option value="">Selecione um cliente</option>';
    clientes.forEach(cliente => {
        const safe = escapeHTML(cliente);
        secClienteSelect.innerHTML += `<option value="${safe}">${safe}</option>`;
    });

    // Atualiza dropdown de clientes no filtro de listagem
    const filterClienteSelect = document.getElementById('filter-cliente');
    filterClienteSelect.innerHTML = '<option value="">Todos os clientes</option>';
    clientes.forEach(cliente => {
        const safe = escapeHTML(cliente);
        filterClienteSelect.innerHTML += `<option value="${safe}">${safe}</option>`;
    });

    // Atualiza dropdown de secretarias no filtro de listagem
    const filterSecretariaSelect = document.getElementById('filter-secretaria');
    filterSecretariaSelect.innerHTML = '<option value="">Todas as secretarias</option>';
    const todasSecretarias = new Set();
    Object.values(secretarias).forEach(secs => {
        secs.forEach(sec => todasSecretarias.add(sec));
    });
    todasSecretarias.forEach(secretaria => {
        const safeSec = escapeHTML(secretaria);
        filterSecretariaSelect.innerHTML += `<option value="${safeSec}">${safeSec}</option>`;
    });

    // Atualiza dropdown de tipos de peça
    const tipoPecaSelect = document.getElementById('tipo-peca');
    tipoPecaSelect.innerHTML = '<option value="">Selecione o tipo</option>';
    tiposPeca.forEach(tipo => {
        const safeTipo = escapeHTML(tipo);
        tipoPecaSelect.innerHTML += `<option value="${safeTipo}">${safeTipo}</option>`;
    });

    // Atualiza dropdown de tipos no filtro
    const filterTipoSelect = document.getElementById('filter-tipo');
    filterTipoSelect.innerHTML = '<option value="">Todos os tipos</option>';
    tiposPeca.forEach(tipo => {
        const safeTipo = escapeHTML(tipo);
        filterTipoSelect.innerHTML += `<option value="${safeTipo}">${safeTipo}</option>`;
    });
}

// Renderizar lista de clientes
function renderizarClientes() {
    const lista = document.getElementById('lista-clientes');
    lista.innerHTML = '';

    clientes.forEach((cliente, index) => {
        const safeDisplay = escapeHTML(cliente);
        const encodedCliente = encodeURIComponent(cliente);
        const item = document.createElement('div');
        item.className = 'config-item';
        item.innerHTML = `
            <div class="config-item-content">
                <div class="config-item-title">${safeDisplay}</div>
                <div class="config-item-subtitle">${secretarias[cliente] ? secretarias[cliente].length : 0} secretaria(s)</div>
            </div>
            <div class="config-item-actions">
                <button class="btn-icon btn-icon-delete" onclick="deletarCliente(decodeURIComponent('${encodedCliente}'))">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="3 6 5 6 21 6"/>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                    </svg>
                </button>
            </div>
        `;
        lista.appendChild(item);
    });
}

// Adicionar cliente
document.getElementById('btn-add-cliente').addEventListener('click', async () => {
    if (!verificarPermissao('config')) {
        return;
    }
    const input = document.getElementById('novo-cliente');
    const nomeCliente = input.value.trim();

    if (!nomeCliente) {
        showMessage('Digite o nome do cliente!', 'error');
        return;
    }

    if (clientes.includes(nomeCliente)) {
        showMessage('Cliente já existe!', 'error');
        return;
    }

    try {
        await apiRequest('/api/clientes', { method: 'POST', body: { nome: nomeCliente } });
        await atualizarConfiguracoesUI();
        input.value = '';
        showMessage('Cliente adicionado com sucesso!', 'success');
    } catch (error) {
        showMessage(error.message || 'Erro ao adicionar cliente.', 'error');
    }
});

// Deletar cliente
async function deletarCliente(nomeCliente) {
    if (!verificarPermissao('config')) {
        return;
    }
    if (confirm(`Tem certeza que deseja excluir o cliente "${nomeCliente}"? Isso também excluirá todas as secretarias associadas.`)) {
        const clienteId = clienteIdMap[nomeCliente];
        if (!clienteId) {
            showMessage('Não foi possível identificar o cliente selecionado.', 'error');
            return;
        }
        try {
            await apiRequest(`/api/clientes/${clienteId}`, { method: 'DELETE' });
            await atualizarConfiguracoesUI();
            showMessage('Cliente excluído com sucesso!', 'success');
        } catch (error) {
            showMessage(error.message || 'Erro ao excluir cliente.', 'error');
        }
    }
}

// Renderizar lista de secretarias
function renderizarSecretarias() {
    const lista = document.getElementById('lista-secretarias');
    const clienteSelecionado = document.getElementById('secretaria-cliente').value;

    lista.innerHTML = '';

    if (!clienteSelecionado) {
        lista.innerHTML = '<p style="text-align: center; color: var(--text-muted); padding: 2rem;">Selecione um cliente para visualizar as secretarias</p>';
        return;
    }

    const secretariasCliente = secretarias[clienteSelecionado] || [];

    if (secretariasCliente.length === 0) {
        lista.innerHTML = '<p style="text-align: center; color: var(--text-muted); padding: 2rem;">Nenhuma secretaria cadastrada para este cliente</p>';
        return;
    }

    secretariasCliente.forEach(secretaria => {
        const safeDisplay = escapeHTML(secretaria);
        const encodedSecretaria = encodeURIComponent(secretaria);
        const encodedCliente = encodeURIComponent(clienteSelecionado);
        const item = document.createElement('div');
        item.className = 'config-item';
        item.innerHTML = `
            <div class="config-item-content">
                <div class="config-item-title">${safeDisplay}</div>
                <div class="config-item-subtitle">${escapeHTML(clienteSelecionado)}</div>
            </div>
            <div class="config-item-actions">
                <button class="btn-icon btn-icon-delete" onclick="deletarSecretaria(decodeURIComponent('${encodedCliente}'), decodeURIComponent('${encodedSecretaria}'))">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="3 6 5 6 21 6"/>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                    </svg>
                </button>
            </div>
        `;
        lista.appendChild(item);
    });
}

// Adicionar secretaria
document.getElementById('btn-add-secretaria').addEventListener('click', async () => {
    if (!verificarPermissao('config')) {
        return;
    }
    const clienteSelecionado = document.getElementById('secretaria-cliente').value;
    const input = document.getElementById('nova-secretaria');
    const nomeSecretaria = input.value.trim();

    if (!clienteSelecionado) {
        showMessage('Selecione um cliente!', 'error');
        return;
    }

    if (!nomeSecretaria) {
        showMessage('Digite o nome da secretaria!', 'error');
        return;
    }

    if (secretarias[clienteSelecionado] && secretarias[clienteSelecionado].includes(nomeSecretaria)) {
        showMessage('Secretaria já existe para este cliente!', 'error');
        return;
    }

    const clienteId = clienteIdMap[clienteSelecionado];
    if (!clienteId) {
        showMessage('Cliente inválido.', 'error');
        return;
    }

    try {
        await apiRequest('/api/secretarias', {
            method: 'POST',
            body: { clienteId, nome: nomeSecretaria },
        });
        await carregarSecretariasDoCliente(clienteSelecionado);
        atualizarDropdowns();
        renderizarSecretarias();
        renderizarClientes();
        input.value = '';
        showMessage('Secretaria adicionada com sucesso!', 'success');
    } catch (error) {
        showMessage(error.message || 'Erro ao adicionar secretaria.', 'error');
    }
});

// Deletar secretaria
async function deletarSecretaria(cliente, secretaria) {
    if (!verificarPermissao('config')) {
        return;
    }
    if (confirm(`Tem certeza que deseja excluir a secretaria "${secretaria}"?`)) {
        const secretariaId = secretariaIdMap[`${cliente}::${secretaria}`];
        if (!secretariaId) {
            showMessage('Não foi possível localizar a secretaria selecionada.', 'error');
            return;
        }
        try {
            await apiRequest(`/api/secretarias/${secretariaId}`, { method: 'DELETE' });
            await carregarSecretariasDoCliente(cliente);
            renderizarSecretarias();
            renderizarClientes();
            atualizarDropdowns();
            showMessage('Secretaria excluída com sucesso!', 'success');
        } catch (error) {
            showMessage(error.message || 'Erro ao excluir secretaria.', 'error');
        }
    }
}

// Event listener para mudança de cliente na configuração
document.getElementById('secretaria-cliente').addEventListener('change', renderizarSecretarias);

// Event listener para mudança de cliente no cadastro de peça
document.getElementById('cliente').addEventListener('change', function() {
    const clienteSelecionado = this.value;
    const secretariaSelect = document.getElementById('secretaria');

    secretariaSelect.innerHTML = '<option value="">Selecione uma secretaria</option>';

    if (clienteSelecionado && secretarias[clienteSelecionado]) {
        secretarias[clienteSelecionado].forEach(secretaria => {
            const safeSec = escapeHTML(secretaria);
            secretariaSelect.innerHTML += `<option value="${safeSec}">${safeSec}</option>`;
        });
    }
});

// Atualiza dropdown de secretarias no relatório quando cliente for selecionado
document.getElementById('rel-cliente').addEventListener('change', function() {
    const clienteSelecionado = this.value;
    const secretariaSelect = document.getElementById('rel-secretaria');

    secretariaSelect.innerHTML = '<option value="">Todas as secretarias</option>';

    if (clienteSelecionado && secretarias[clienteSelecionado]) {
        secretarias[clienteSelecionado].forEach(secretaria => {
            const safeSec = escapeHTML(secretaria);
            secretariaSelect.innerHTML += `<option value="${safeSec}">${safeSec}</option>`;
        });
    } else if (!clienteSelecionado) {
        // Mostra todas as secretarias de todos os clientes
        const todasSecretarias = new Set();
        Object.values(secretarias).forEach(secs => {
            secs.forEach(sec => todasSecretarias.add(sec));
        });
        todasSecretarias.forEach(secretaria => {
            const safeSec = escapeHTML(secretaria);
            secretariaSelect.innerHTML += `<option value="${safeSec}">${safeSec}</option>`;
        });
    }
});

// Renderizar lista de tipos de peça
function renderizarTiposPeca() {
    const lista = document.getElementById('lista-tipos');
    lista.innerHTML = '';

    tiposPeca.forEach(tipo => {
        const encodedTipo = encodeURIComponent(tipo);
        const item = document.createElement('div');
        item.className = 'config-item';
        item.innerHTML = `
            <div class="config-item-content">
                <div class="config-item-title">${escapeHTML(tipo)}</div>
                <div class="config-item-subtitle">Disponível para todos os clientes</div>
            </div>
            <div class="config-item-actions">
                <button class="btn-icon btn-icon-delete" onclick="deletarTipoPeca(decodeURIComponent('${encodedTipo}'))">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="3 6 5 6 21 6"/>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                    </svg>
                </button>
            </div>
        `;
        lista.appendChild(item);
    });
}

// Adicionar tipo de peça
document.getElementById('btn-add-tipo').addEventListener('click', async () => {
    if (!verificarPermissao('config')) {
        return;
    }
    const input = document.getElementById('novo-tipo');
    const nomeTipo = input.value.trim();

    if (!nomeTipo) {
        showMessage('Digite o tipo de peça!', 'error');
        return;
    }

    if (tiposPeca.includes(nomeTipo)) {
        showMessage('Tipo de peça já existe!', 'error');
        return;
    }

    try {
        await apiRequest('/api/tipos-peca', { method: 'POST', body: { nome: nomeTipo } });
        await carregarTiposPeca();
        atualizarDropdowns();
        renderizarTiposPeca();
        input.value = '';
        showMessage('Tipo de peça adicionado com sucesso!', 'success');
    } catch (error) {
        showMessage(error.message || 'Erro ao adicionar tipo de peça.', 'error');
    }
});

// Deletar tipo de peça
async function deletarTipoPeca(tipo) {
    if (!verificarPermissao('config')) {
        return;
    }
    if (confirm(`Tem certeza que deseja excluir o tipo "${tipo}"?`)) {
        const tipoId = tipoPecaIdMap[tipo];
        if (!tipoId) {
            showMessage('Tipo de peça inválido.', 'error');
            return;
        }
        try {
            await apiRequest(`/api/tipos-peca/${tipoId}`, { method: 'DELETE' });
            await carregarTiposPeca();
            atualizarDropdowns();
            renderizarTiposPeca();
            showMessage('Tipo de peça excluído com sucesso!', 'success');
        } catch (error) {
            showMessage(error.message || 'Erro ao excluir tipo de peça.', 'error');
        }
    }
}

// ==================== EDIÇÃO DE PEÇA ====================
const modalEdicao = document.getElementById('modal-edicao');
const modalCloseEdit = document.querySelector('.modal-close-edit');
const formEdicao = document.getElementById('form-edicao');
const editFileInput = document.getElementById('edit-comprovacao');
const editPreviewImage = document.getElementById('edit-preview-image');
const editFilePreview = document.querySelector('.file-preview-edit');
const removeFileEditBtn = document.querySelector('.remove-file-edit');

let editArquivoSelecionado = null;
let pecaEmEdicao = null;

// Função para abrir modal de edição
async function editarPeca(id) {
    if (!verificarPermissao('editar')) {
        return;
    }

    let peca;
    try {
        peca = await apiRequest(`/api/pecas/${id}`);
    } catch (error) {
        showMessage(error.message || 'Erro ao carregar peça.', 'error');
        return;
    }

    if (!peca) {
        showMessage('Peça não encontrada.', 'error');
        return;
    }
    pecaEmEdicao = peca;

    // Preenche o ID
    document.getElementById('edit-id').value = peca.id;

    // Atualiza dropdowns de edição
    const editClienteSelect = document.getElementById('edit-cliente');
    editClienteSelect.innerHTML = '<option value="">Selecione um cliente</option>';
    clientes.forEach(cliente => {
        const safeCliente = escapeHTML(cliente);
        editClienteSelect.innerHTML += `<option value="${safeCliente}">${safeCliente}</option>`;
    });
    editClienteSelect.value = peca.cliente;

    // Atualiza dropdown de secretaria baseado no cliente
    const editSecretariaSelect = document.getElementById('edit-secretaria');
    editSecretariaSelect.innerHTML = '<option value="">Selecione uma secretaria</option>';
    if (secretarias[peca.cliente]) {
        secretarias[peca.cliente].forEach(secretaria => {
            const safeSec = escapeHTML(secretaria);
            editSecretariaSelect.innerHTML += `<option value="${safeSec}">${safeSec}</option>`;
        });
    }
    editSecretariaSelect.value = peca.secretaria;

    // Atualiza dropdown de tipo de peça
    const editTipoPecaSelect = document.getElementById('edit-tipo-peca');
    editTipoPecaSelect.innerHTML = '<option value="">Selecione o tipo</option>';
    tiposPeca.forEach(tipo => {
        const safeTipo = escapeHTML(tipo);
        editTipoPecaSelect.innerHTML += `<option value="${safeTipo}">${safeTipo}</option>`;
    });
    editTipoPecaSelect.value = peca.tipoPeca;

    // Preenche outros campos
    document.getElementById('edit-nome-peca').value = peca.nomePeca;
    document.getElementById('edit-data-criacao').value = peca.dataCriacao;
    document.getElementById('edit-data-veiculacao').value = peca.dataVeiculacao || '';
    document.getElementById('edit-observacao').value = peca.observacao || '';

    // Mostra preview da imagem atual
    if (peca.comprovacao) {
        editPreviewImage.src = peca.comprovacao;
        editFilePreview.style.display = 'block';
    } else {
        editPreviewImage.src = '';
        editFilePreview.style.display = 'none';
    }
    editArquivoSelecionado = null;

    // Abre modal
    modalEdicao.classList.add('active');
}

// Event listener para mudança de cliente no modal de edição
document.getElementById('edit-cliente').addEventListener('change', function() {
    const clienteSelecionado = this.value;
    const editSecretariaSelect = document.getElementById('edit-secretaria');

    editSecretariaSelect.innerHTML = '<option value="">Selecione uma secretaria</option>';

    if (clienteSelecionado && secretarias[clienteSelecionado]) {
        secretarias[clienteSelecionado].forEach(secretaria => {
            const safeSec = escapeHTML(secretaria);
            editSecretariaSelect.innerHTML += `<option value="${safeSec}">${safeSec}</option>`;
        });
    }
});

// Event listener para upload de arquivo no modal de edição
editFileInput.addEventListener('change', function(e) {
    const file = e.target.files[0];

    if (file) {
        if (!file.type.startsWith('image/')) {
            showMessage('Por favor, selecione apenas arquivos de imagem!', 'error');
            return;
        }

        if (file.size > 5 * 1024 * 1024) {
            showMessage('O arquivo deve ter no máximo 5MB!', 'error');
            return;
        }

        editArquivoSelecionado = file;
        const reader = new FileReader();

        reader.onload = function(e) {
            editPreviewImage.src = e.target.result;
            editFilePreview.style.display = 'block';
        };

        reader.readAsDataURL(file);
    }
});

// Remover arquivo de edição
removeFileEditBtn.addEventListener('click', function() {
    editFileInput.value = '';
    editArquivoSelecionado = null;
    // Mantém a imagem original
    if (pecaEmEdicao && pecaEmEdicao.comprovacao) {
        editPreviewImage.src = pecaEmEdicao.comprovacao;
    }
});

// Fechar modal de edição
modalCloseEdit.addEventListener('click', () => {
    modalEdicao.classList.remove('active');
    formEdicao.reset();
    editArquivoSelecionado = null;
    pecaEmEdicao = null;
});

document.getElementById('btn-cancelar-edicao').addEventListener('click', () => {
    modalEdicao.classList.remove('active');
    formEdicao.reset();
    editArquivoSelecionado = null;
    pecaEmEdicao = null;
});

modalEdicao.addEventListener('click', (e) => {
    if (e.target === modalEdicao) {
        modalEdicao.classList.remove('active');
        formEdicao.reset();
        editArquivoSelecionado = null;
        pecaEmEdicao = null;
    }
});

// Salvar edição
formEdicao.addEventListener('submit', async function(e) {
    e.preventDefault();

    const pecaId = parseInt(document.getElementById('edit-id').value);
    const payload = {
        cliente: document.getElementById('edit-cliente').value,
        secretaria: document.getElementById('edit-secretaria').value,
        tipoPeca: document.getElementById('edit-tipo-peca').value,
        nomePeca: document.getElementById('edit-nome-peca').value,
        dataCriacao: document.getElementById('edit-data-criacao').value,
        dataVeiculacao: document.getElementById('edit-data-veiculacao').value || null,
        observacao: document.getElementById('edit-observacao').value || '',
    };

    if (editArquivoSelecionado) {
        payload.comprovacao = editPreviewImage.src;
    }

    try {
        await apiRequest(`/api/pecas/${pecaId}`, { method: 'PUT', body: payload });
        modalEdicao.classList.remove('active');
        formEdicao.reset();
        editArquivoSelecionado = null;
        pecaEmEdicao = null;
        await renderizarPecas();
        showMessage('Peça atualizada com sucesso!', 'success');
    } catch (error) {
        showMessage(error.message || 'Erro ao atualizar peça.', 'error');
    }
});

// ==================== SISTEMA DE AUTENTICAÇÃO E PERMISSÕES ====================

// Toggle dropdown do usuário
document.getElementById('user-avatar').addEventListener('click', (e) => {
    e.stopPropagation();
    document.getElementById('user-dropdown').classList.toggle('active');
});

// Fechar dropdown ao clicar fora
document.addEventListener('click', () => {
    document.getElementById('user-dropdown').classList.remove('active');
});

// Abrir modal de login
function abrirLogin() {
    if (authDisabled) {
        showMessage('Modo teste ativo: login está desabilitado.', 'info');
        return;
    }
    document.getElementById('modal-login').classList.add('active');
    document.getElementById('user-dropdown').classList.remove('active');
}

// Fechar modal de login
const modalLogin = document.getElementById('modal-login');
const modalCloseLogin = document.querySelector('.modal-close-login');

modalCloseLogin.addEventListener('click', () => {
    modalLogin.classList.remove('active');
});

modalLogin.addEventListener('click', (e) => {
    if (e.target === modalLogin) {
        modalLogin.classList.remove('active');
    }
});

// Processo de login
document.getElementById('form-login').addEventListener('submit', async function(e) {
    e.preventDefault();

    if (authDisabled) {
        showMessage('Modo teste ativo: autenticação manual está desabilitada.', 'info');
        modalLogin.classList.remove('active');
        return;
    }

    const username = document.getElementById('login-username').value;
    const password = document.getElementById('login-password').value;

    try {
        const response = await apiRequest('/auth/login', {
            method: 'POST',
            body: { username, password },
            auth: false,
        });

        setAuthData(response.access_token, {
            id: response.user.id,
            username: response.user.username,
            nome: response.user.nome,
            role: response.user.role,
        });

        await carregarDadosBase();
        await renderizarPecas();
        atualizarInterfaceUsuario();
        modalLogin.classList.remove('active');

        document.getElementById('form-login').reset();
        showMessage(`Bem-vindo, ${usuarioAtual.nome}!`, 'success');
    } catch (error) {
        showMessage(error.message || 'Usuário ou senha incorretos!', 'error');
    }
});

// Logout
async function logout() {
    if (authDisabled) {
        showMessage('Modo teste ativo: logout está desabilitado.', 'info');
        return;
    }
    if (confirm('Tem certeza que deseja sair?')) {
        setAuthData(null, null);
        pecas = [];
        clientes = [];
        clienteIdMap = {};
        secretarias = {};
        secretariaIdMap = {};
        tiposPeca = [];
        tipoPecaIdMap = {};
        usuarios = [];

        atualizarDropdowns();
        renderizarClientes();
        renderizarSecretarias();
        renderizarTiposPeca();
        await renderizarPecas();
        atualizarInterfaceUsuario();
        showMessage('Você saiu do sistema', 'success');

        // Fechar painel de admin se estiver aberto
        document.getElementById('admin-panel').style.display = 'none';
    }
}

// Atualizar interface baseado no usuário logado
function atualizarInterfaceUsuario() {
    const userNameDisplay = document.getElementById('user-name-display');
    const dropdownUserName = document.getElementById('dropdown-user-name');
    const dropdownUserRole = document.getElementById('dropdown-user-role');
    const btnLogin = document.getElementById('btn-login');
    const btnAdmin = document.getElementById('btn-admin');
    const btnLogout = document.getElementById('btn-logout');

    if (usuarioAtual) {
        const perm = permissoes[usuarioAtual.role];

        userNameDisplay.textContent = usuarioAtual.nome;
        dropdownUserName.textContent = usuarioAtual.nome;
        dropdownUserRole.textContent = perm.nome;

        btnLogin.style.display = 'none';
        btnLogout.style.display = 'flex';

        // Mostrar botão admin apenas para usuários com permissão
        if (perm.podeAdmin) {
            btnAdmin.style.display = 'flex';
        } else {
            btnAdmin.style.display = 'none';
        }

        aplicarPermissoes();
    } else {
        userNameDisplay.textContent = 'Visitante';
        dropdownUserName.textContent = 'Visitante';
        dropdownUserRole.textContent = 'Sem permissão';

        btnLogin.style.display = 'flex';
        btnAdmin.style.display = 'none';
        btnLogout.style.display = 'none';

        removerPermissoes();
    }
}

// Aplicar permissões na interface
function aplicarPermissoes() {
    if (!usuarioAtual) return;

    const perm = permissoes[usuarioAtual.role];
    if (!perm) {
        showMessage('Permissões do usuário são inválidas.', 'error');
        return false;
    }

    // Controlar acesso às abas
    const tabs = document.querySelectorAll('.tab-btn');
    tabs.forEach(tab => {
        const tabName = tab.dataset.tab;

        if (tabName === 'configuracao' && !perm.podeConfig) {
            tab.style.display = 'none';
        } else if (tabName === 'relatorio' && !perm.podeRelatorio) {
            tab.style.display = 'none';
        } else {
            tab.style.display = '';
        }
    });

    // Controlar botões de ação
    if (!perm.podeInserir) {
        // Ocultar aba de cadastro
        const cadastroTab = document.querySelector('[data-tab="cadastro"]');
        if (cadastroTab) cadastroTab.style.display = 'none';
    }
}

// Remover permissões (voltar ao padrão visitante)
function removerPermissoes() {
    // Ocultar todas as abas para visitantes
    const tabs = document.querySelectorAll('.tab-btn');
    tabs.forEach(tab => {
        const tabName = tab.dataset.tab;
        if (tabName !== 'listagem') {
            tab.style.display = 'none';
        }
    });

    // Ir para aba de listagem
    tabs.forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(tc => tc.classList.remove('active'));

    const listagemTab = document.querySelector('[data-tab="listagem"]');
    if (listagemTab) {
        listagemTab.classList.add('active');
        document.getElementById('listagem').classList.add('active');
    }
}

// Verificar permissão antes de executar ação
function verificarPermissao(acao) {
    if (!usuarioAtual) {
        showMessage('Você precisa estar logado para realizar esta ação!', 'error');
        abrirLogin();
        return false;
    }

    const perm = permissoes[usuarioAtual.role];

    if (acao === 'inserir' && !perm.podeInserir) {
        showMessage('Você não tem permissão para inserir peças!', 'error');
        return false;
    }
    if (acao === 'editar' && !perm.podeEditar) {
        showMessage('Você não tem permissão para editar peças!', 'error');
        return false;
    }
    if (acao === 'deletar' && !perm.podeDeletar) {
        showMessage('Você não tem permissão para deletar peças!', 'error');
        return false;
    }
    if (acao === 'relatorio' && !perm.podeRelatorio) {
        showMessage('Você não tem permissão para gerar relatórios!', 'error');
        return false;
    }
    if (acao === 'config' && !perm.podeConfig) {
        showMessage('Você não tem permissão para alterar as configurações!', 'error');
        return false;
    }

    return true;
}

// ==================== PAINEL DE ADMINISTRAÇÃO ====================

// Abrir painel de administração
async function abrirAdmin() {
    if (!usuarioAtual || !permissoes[usuarioAtual.role].podeAdmin) {
        showMessage('Você não tem permissão para acessar a administração!', 'error');
        return;
    }

    document.getElementById('admin-panel').style.display = 'block';
    document.getElementById('user-dropdown').classList.remove('active');
    await renderizarUsuarios();
}

// Fechar painel de administração
function fecharAdmin() {
    document.getElementById('admin-panel').style.display = 'none';
}

// Renderizar lista de usuários
async function renderizarUsuarios() {
    const lista = document.getElementById('lista-usuarios');
    lista.innerHTML = '<tr><td colspan="4" style="text-align:center;">Carregando usuários...</td></tr>';

    try {
        usuarios = await apiRequest('/api/usuarios');
    } catch (error) {
        lista.innerHTML = '<tr><td colspan="4" style="text-align:center;color:var(--text-muted);">Erro ao carregar usuários.</td></tr>';
        showMessage(error.message || 'Erro ao carregar usuários.', 'error');
        return;
    }

    if (!usuarios.length) {
        lista.innerHTML = '<tr><td colspan="4" style="text-align:center;color:var(--text-muted);">Nenhum usuário encontrado.</td></tr>';
        return;
    }

    lista.innerHTML = '';
    usuarios.forEach(usuario => {
        const perm = permissoes[usuario.role] || { nome: usuario.role, descricao: '' };
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${escapeHTML(usuario.nome || usuario.username)}</strong></td>
            <td><span class="permission-badge ${escapeHTML(usuario.role)}">${escapeHTML(perm.nome)}</span></td>
            <td>${escapeHTML(perm.descricao)}</td>
            <td>
                <button class="btn-table btn-table-delete" onclick="deletarUsuario(${usuario.id})">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="3 6 5 6 21 6"/>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                    </svg>
                    Excluir
                </button>
            </td>
        `;
        lista.appendChild(tr);
    });
}

// Cadastrar novo usuário
document.getElementById('form-usuario').addEventListener('submit', async function(e) {
    e.preventDefault();

    const username = document.getElementById('novo-usuario').value.trim();
    const password = document.getElementById('nova-senha').value;
    const role = document.getElementById('nova-permissao').value;

    if (!username || !password || !role) {
        showMessage('Preencha todos os campos!', 'error');
        return;
    }

    try {
        await apiRequest('/api/usuarios', {
            method: 'POST',
            body: {
                username,
                nome: username,
                password,
                role,
                isActive: true,
            },
        });
        this.reset();
        await renderizarUsuarios();
        showMessage('Usuário cadastrado com sucesso!', 'success');
    } catch (error) {
        showMessage(error.message || 'Erro ao cadastrar usuário.', 'error');
    }
});

// Deletar usuário
async function deletarUsuario(id) {
    // Não permitir deletar o próprio usuário ou o admin padrão
    if (usuarioAtual && usuarioAtual.id === id) {
        showMessage('Você não pode deletar seu próprio usuário!', 'error');
        return;
    }

    if (id === 1) {
        showMessage('Não é possível deletar o administrador padrão!', 'error');
        return;
    }

    if (confirm('Tem certeza que deseja excluir este usuário?')) {
        try {
            await apiRequest(`/api/usuarios/${id}`, { method: 'DELETE' });
            await renderizarUsuarios();
            showMessage('Usuário excluído com sucesso!', 'success');
        } catch (error) {
            showMessage(error.message || 'Erro ao excluir usuário.', 'error');
        }
    }
}

// ==================== INICIALIZAÇÃO ====================
document.addEventListener('DOMContentLoaded', async () => {
    await sincronizarModoAutenticacao();

    // Define data atual nos campos de data
    const hoje = new Date().toISOString().split('T')[0];
    document.getElementById('data-criacao').value = hoje;
    document.getElementById('rel-data-inicio').value = hoje;
    document.getElementById('rel-data-fim').value = hoje;

    atualizarInterfaceUsuario();

    if (authToken && usuarioAtual) {
        try {
            await carregarDadosBase();
            await renderizarPecas();
        } catch (error) {
            showMessage(error.message || 'Erro ao carregar dados iniciais.', 'error');
        }
    } else {
        atualizarDropdowns();
        renderizarClientes();
        renderizarSecretarias();
        renderizarTiposPeca();
        renderizarPecas();
        if (!authDisabled) {
            // Abre o modal de login automaticamente para evitar uso sem autenticação
            abrirLogin();
        }
    }
});
