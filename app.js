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
        try {
            const data = await response.json();
            detail = data.detail || data.message || JSON.stringify(data);
        } catch {
            // Ignora parse de erro
        }
        throw new Error(detail || 'Erro ao comunicar com o servidor.');
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

    // ===== CABEÇALHO COM CORES E DESIGN =====
    // Faixa diagonal preta (superior esquerda)
    doc.setFillColor(0, 0, 0);
    doc.triangle(0, 0, 60, 0, 0, 30, 'F');

    // Faixa diagonal turquesa/verde-água
    doc.setFillColor(64, 190, 175); // Cor turquesa similar à imagem
    doc.triangle(60, 0, pageWidth, 0, pageWidth, 45, 'F');
    doc.triangle(60, 0, 0, 30, pageWidth, 45, 'F');

    // Logo MSL Estratégia (você pode adicionar a logo depois)
    const logoBase64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAABOoAAAS3CAYAAABYEpX2AAAACXBIWXMAAC4jAAAuIwF4pT92AAAFzGlUWHRYTUw6Y29tLmFkb2JlLnhtcAAAAAAAPD94cGFja2V0IGJlZ2luPSLvu78iIGlkPSJXNU0wTXBDZWhpSHpyZVN6TlRjemtjOWQiPz4gPHg6eG1wbWV0YSB4bWxuczp4PSJhZG9iZTpuczptZXRhLyIgeDp4bXB0az0iQWRvYmUgWE1QIENvcmUgOS4xLWMwMDMgNzkuOTY5MGE4NywgMjAyNS8wMy8wNi0xOToxMjowMyAgICAgICAgIj4gPHJkZjpSREYgeG1sbnM6cmRmPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5LzAyLzIyLXJkZi1zeW50YXgtbnMjIj4gPHJkZjpEZXNjcmlwdGlvbiByZGY6YWJvdXQ9IiIgeG1sbnM6eG1wPSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvIiB4bWxuczpkYz0iaHR0cDovL3B1cmwub3JnL2RjL2VsZW1lbnRzLzEuMS8iIHhtbG5zOnBob3Rvc2hvcD0iaHR0cDovL25zLmFkb2JlLmNvbS9waG90b3Nob3AvMS4wLyIgeG1sbnM6eG1wTU09Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC9tbS8iIHhtbG5zOnN0RXZ0PSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvc1R5cGUvUmVzb3VyY2VFdmVudCMiIHhtcDpDcmVhdG9yVG9vbD0iQWRvYmUgUGhvdG9zaG9wIDI2LjExIChXaW5kb3dzKSIgeG1wOkNyZWF0ZURhdGU9IjIwMjUtMDMtMDdUMTA6MjM6MDUtMDM6MDAiIHhtcDpNb2RpZnlEYXRlPSIyMDI1LTEwLTIwVDA5OjE1OjI0LTAzOjAwIiB4bXA6TWV0YWRhdGFEYXRlPSIyMDI1LTEwLTIwVDA5OjE1OjI0LTAzOjAwIiBkYzpmb3JtYXQ9ImltYWdlL3BuZyIgcGhvdG9zaG9wOkNvbG9yTW9kZT0iMyIgeG1wTU06SW5zdGFuY2VJRD0ieG1wLmlpZDplZTVlM2VjNy05MDE4LWNhNDMtOWM2Yy02ZjM5MThkYjBjOTkiIHhtcE1NOkRvY3VtZW50SUQ9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'; // Cole o código Base64 da logo aqui
try {
    doc.addImage(logoBase64, 'PNG', pageWidth - 50, 5, 40, 16); // Ajuste posição e tamanho conforme necessário
} catch (error) {
    // Se houver erro ao carregar a logo, usa o texto
    doc.setFontSize(18);
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.text('MSL ESTRATÉGIA', pageWidth - 65, 12);
}
    // Por enquanto, vou adicionar o texto
    doc.setFontSize(18);
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.text('MSL ESTRATÉGIA', pageWidth - 65, 12);

    // Texto do cabeçalho
    doc.setFontSize(14);
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.text('ATIVIDADES DA PREFEITURA', pageWidth / 2, 20, { align: 'center' });

    doc.setFontSize(12);
    const clienteNome = info.cliente || 'Todos os clientes';
    doc.text(`DE ${clienteNome.toUpperCase()}`, pageWidth / 2, 27, { align: 'center' });

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    const periodoTexto = info.dataInicio && info.dataFim
        ? `${formatarData(info.dataInicio)} até ${formatarData(info.dataFim)}`
        : '-';
    doc.text(`NO PERÍODO: ${periodoTexto}`, pageWidth / 2, 33, { align: 'center' });

    // Título da seção
    let yPosition = 52;
    doc.setFontSize(12);
    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'bold');

    const secretariaNome = info.secretaria || 'Todas as secretarias';
    let tituloSecao = secretariaNome !== 'Todas as secretarias'
        ? secretariaNome.toUpperCase()
        : 'TODAS AS SECRETARIAS';

    doc.text(tituloSecao, 14, yPosition);

    yPosition += 8;

    // ===== TABELA DE PEÇAS =====
    if (linhas && linhas.length > 0) {
        doc.autoTable({
            startY: yPosition,
            head: [['#', 'Tipo de Peça', 'Nome da Peça', 'Secretaria', 'Criação', 'Veiculação']],
            body: linhas.map((linha, index) => {
                return [
                    (index + 1).toString(),
                    linha.tipoPeca || '-',
                    linha.nomePeca || '-',
                    linha.secretaria || '-',
                    linha.dataCriacao ? formatarData(linha.dataCriacao) : '-',
                    linha.dataVeiculacao ? formatarData(linha.dataVeiculacao) : '-'
                ];
            }),
            theme: 'grid',
            styles: {
                fontSize: 9,
                cellPadding: 3,
                lineColor: [200, 200, 200],
                lineWidth: 0.1
            },
            headStyles: {
                fillColor: [64, 190, 175], // Cor turquesa
                textColor: [255, 255, 255],
                fontStyle: 'bold',
                halign: 'center'
            },
            columnStyles: {
                0: { cellWidth: 10, halign: 'center' }, // #
                1: { cellWidth: 30, halign: 'left' },   // Tipo
                2: { cellWidth: 60, halign: 'left' },   // Nome
                3: { cellWidth: 40, halign: 'left' },   // Secretaria
                4: { cellWidth: 22, halign: 'center' }, // Criação
                5: { cellWidth: 22, halign: 'center' }  // Veiculação
            },
            alternateRowStyles: {
                fillColor: [245, 245, 245]
            },
            margin: { left: 14, right: 14 }
        });

        // Posição final após a tabela
        yPosition = doc.lastAutoTable.finalY + 10;
    }

    // ===== TOTALIZADOR =====
    doc.setFillColor(64, 190, 175);
    doc.rect(14, yPosition, pageWidth - 28, 12, 'F');

    doc.setFontSize(11);
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    const totalPecas = stats.totalPecas || 0;
    doc.text(`TOTAL DE PEÇAS: ${totalPecas}`, pageWidth / 2, yPosition + 8, { align: 'center' });

    // ===== RODAPÉ =====
    const rodapeY = pageHeight - 15;
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.setFont('helvetica', 'normal');
    const dataGeracao = new Date().toLocaleString('pt-BR');
    doc.text(`Relatório gerado em ${dataGeracao} - SIGEPRE Sistema MSL Estratégia`, pageWidth / 2, rodapeY, { align: 'center' });

    // ===== SALVAR PDF =====
    const clienteArquivo = (info.cliente || 'Todos').replace(/\s+/g, '_');
    const nomeArquivo = `Relatorio_${clienteArquivo}_${new Date().toISOString().split('T')[0]}.pdf`;
    doc.save(nomeArquivo);

    showMessage('Relatório PDF gerado com sucesso!', 'success');
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
