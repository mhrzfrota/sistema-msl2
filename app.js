// Sistema de Gestão de Peças - MSL2
// Storage para armazenar as peças cadastradas
let pecas = JSON.parse(localStorage.getItem('pecas')) || [];

// Storage para configurações
let clientes = JSON.parse(localStorage.getItem('clientes')) || [
    'Cliente A', 'Cliente B', 'Cliente C'
];
let secretarias = JSON.parse(localStorage.getItem('secretarias')) || {
    'Cliente A': ['Secretaria de Saúde', 'Secretaria de Educação'],
    'Cliente B': ['Secretaria de Cultura', 'Secretaria de Obras'],
    'Cliente C': ['Secretaria de Turismo']
};
let tiposPeca = JSON.parse(localStorage.getItem('tiposPeca')) || [
    'Matéria', 'Nota', 'Reportagem', 'Entrevista', 'Release'
];

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
formCadastro.addEventListener('submit', function(e) {
    e.preventDefault();

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
        id: Date.now(),
        cliente: document.getElementById('cliente').value,
        secretaria: document.getElementById('secretaria').value,
        tipoPeca: document.getElementById('tipo-peca').value,
        nomePeca: document.getElementById('nome-peca').value,
        dataCriacao: document.getElementById('data-criacao').value,
        dataVeiculacao: document.getElementById('data-veiculacao').value || null,
        observacao: document.getElementById('observacao').value || '',
        comprovacao: previewImage.src,
        dataCadastro: new Date().toISOString()
    };

    // Adiciona ao array
    pecas.push(novaPeca);

    // Salva no localStorage
    salvarPecas();

    // Limpa o formulário
    formCadastro.reset();
    fileInput.value = '';
    arquivoSelecionado = null;
    filePlaceholder.style.display = 'block';
    filePreview.style.display = 'none';
    previewImage.src = '';

    // Mensagem de sucesso
    showMessage('Peça cadastrada com sucesso!', 'success');
});

// ==================== GERAÇÃO DE RELATÓRIO ====================
formRelatorio.addEventListener('submit', function(e) {
    e.preventDefault();

    const cliente = document.getElementById('rel-cliente').value;
    const secretaria = document.getElementById('rel-secretaria').value;
    const dataInicio = document.getElementById('rel-data-inicio').value;
    const dataFim = document.getElementById('rel-data-fim').value;

    // Validação de datas
    if (new Date(dataInicio) > new Date(dataFim)) {
        showMessage('A data de início não pode ser maior que a data fim!', 'error');
        return;
    }

    // Filtra peças
    let pecasFiltradas = pecas.filter(peca => {
        let matches = true;

        // Filtro por cliente
        if (cliente && peca.cliente !== cliente) {
            matches = false;
        }

        // Filtro por secretaria
        if (secretaria && peca.secretaria !== secretaria) {
            matches = false;
        }

        // Filtro por data
        const dataPeca = new Date(peca.dataCriacao);
        const inicio = new Date(dataInicio);
        const fim = new Date(dataFim);

        if (dataPeca < inicio || dataPeca > fim) {
            matches = false;
        }

        return matches;
    });

    if (pecasFiltradas.length === 0) {
        showMessage('Nenhuma peça encontrada com os filtros selecionados!', 'error');
        return;
    }

    // Gera relatório
    gerarRelatorio(pecasFiltradas, cliente, secretaria, dataInicio, dataFim);
});

function gerarRelatorio(pecasFiltradas, cliente, secretaria, dataInicio, dataFim) {
    const resultadoDiv = document.getElementById('resultado-relatorio');
    const tabelaBody = document.getElementById('tabela-relatorio');

    // Atualiza informações do cabeçalho
    document.getElementById('info-cliente').textContent = cliente || 'Todos os clientes';
    document.getElementById('info-secretaria').textContent = secretaria || 'Todas as secretarias';
    document.getElementById('info-periodo').textContent = `${formatarData(dataInicio)} até ${formatarData(dataFim)}`;

    // Atualiza estatísticas
    document.getElementById('stat-total').textContent = pecasFiltradas.length;

    // Conta secretarias únicas
    const secretariasUnicas = [...new Set(pecasFiltradas.map(p => p.secretaria))];
    document.getElementById('stat-secretarias').textContent = secretariasUnicas.length;

    // Agrupa peças por secretaria e tipo
    const agrupamento = {};

    pecasFiltradas.forEach(peca => {
        const chave = `${peca.secretaria}|${peca.tipoPeca}|${peca.nomePeca}`;

        if (!agrupamento[chave]) {
            agrupamento[chave] = {
                secretaria: peca.secretaria,
                tipoPeca: peca.tipoPeca,
                nomePeca: peca.nomePeca,
                dataCriacao: peca.dataCriacao,
                dataVeiculacao: peca.dataVeiculacao,
                quantidade: 0
            };
        }

        agrupamento[chave].quantidade++;
    });

    // Limpa tabela
    tabelaBody.innerHTML = '';

    // Preenche tabela
    Object.values(agrupamento).forEach(item => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${item.secretaria}</strong></td>
            <td>${item.tipoPeca}</td>
            <td>${item.nomePeca}</td>
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

function renderizarPecas(filtro = '') {
    const listaPecas = document.getElementById('lista-pecas');
    const emptyState = document.getElementById('empty-state');

    if (pecas.length === 0) {
        listaPecas.style.display = 'none';
        emptyState.style.display = 'block';
        return;
    }

    // Aplica filtros
    let pecasFiltradas = pecas;

    const filterCliente = document.getElementById('filter-cliente').value;
    const filterSecretaria = document.getElementById('filter-secretaria').value;
    const filterTipo = document.getElementById('filter-tipo').value;
    const filterDataInicio = document.getElementById('filter-data-inicio').value;
    const filterDataFim = document.getElementById('filter-data-fim').value;

    if (filterCliente) {
        pecasFiltradas = pecasFiltradas.filter(peca => peca.cliente === filterCliente);
    }

    if (filterSecretaria) {
        pecasFiltradas = pecasFiltradas.filter(peca => peca.secretaria === filterSecretaria);
    }

    if (filterTipo) {
        pecasFiltradas = pecasFiltradas.filter(peca => peca.tipoPeca === filterTipo);
    }

    // Filtro por data
    if (filterDataInicio && filterDataFim) {
        pecasFiltradas = pecasFiltradas.filter(peca => {
            const dataPeca = new Date(peca.dataCriacao);
            const dataInicio = new Date(filterDataInicio);
            const dataFim = new Date(filterDataFim);
            return dataPeca >= dataInicio && dataPeca <= dataFim;
        });
    } else if (filterDataInicio) {
        pecasFiltradas = pecasFiltradas.filter(peca => {
            const dataPeca = new Date(peca.dataCriacao);
            const dataInicio = new Date(filterDataInicio);
            return dataPeca >= dataInicio;
        });
    } else if (filterDataFim) {
        pecasFiltradas = pecasFiltradas.filter(peca => {
            const dataPeca = new Date(peca.dataCriacao);
            const dataFim = new Date(filterDataFim);
            return dataPeca <= dataFim;
        });
    }

    if (pecasFiltradas.length === 0) {
        listaPecas.style.display = 'none';
        emptyState.style.display = 'block';
        emptyState.querySelector('h3').textContent = 'Nenhuma peça encontrada';
        emptyState.querySelector('p').textContent = 'Tente ajustar os filtros de busca';
        return;
    }

    // Atualiza classe baseado no modo de visualização
    listaPecas.className = viewMode === 'grid' ? 'pecas-grid' : 'pecas-list';
    listaPecas.style.display = viewMode === 'grid' ? 'grid' : 'flex';
    emptyState.style.display = 'none';
    listaPecas.innerHTML = '';

    // Ordena por data mais recente
    pecasFiltradas.sort((a, b) => new Date(b.dataCadastro) - new Date(a.dataCadastro));

    pecasFiltradas.forEach(peca => {
        const card = document.createElement('div');
        card.className = 'peca-card';
        card.innerHTML = `
            <div class="peca-card-header">
                <div class="peca-card-title">
                    <span class="peca-badge">${peca.tipoPeca}</span>
                    <h3>${peca.nomePeca}</h3>
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
                        <span>${peca.cliente}</span>
                    </div>
                    <div class="peca-info-item">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                            <polyline points="9 22 9 12 15 12 15 22"/>
                        </svg>
                        <strong>Secretaria:</strong>
                        <span>${peca.secretaria}</span>
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
                        <span style="flex: 1;">${peca.observacao}</span>
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
}

// Event listeners para filtros
document.getElementById('filter-cliente').addEventListener('change', function() {
    const clienteSelecionado = this.value;
    const filterSecretariaSelect = document.getElementById('filter-secretaria');

    // Atualiza dropdown de secretarias baseado no cliente selecionado
    filterSecretariaSelect.innerHTML = '<option value="">Todas as secretarias</option>';

    if (clienteSelecionado && secretarias[clienteSelecionado]) {
        secretarias[clienteSelecionado].forEach(secretaria => {
            filterSecretariaSelect.innerHTML += `<option value="${secretaria}">${secretaria}</option>`;
        });
    } else if (!clienteSelecionado) {
        // Se não houver cliente selecionado, mostra todas as secretarias
        const todasSecretarias = new Set();
        Object.values(secretarias).forEach(secs => {
            secs.forEach(sec => todasSecretarias.add(sec));
        });
        todasSecretarias.forEach(secretaria => {
            filterSecretariaSelect.innerHTML += `<option value="${secretaria}">${secretaria}</option>`;
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
function visualizarComprovacao(id) {
    const peca = pecas.find(p => p.id === id);
    if (peca) {
        modalImage.src = peca.comprovacao;
        modal.classList.add('active');
    }
}

function deletarPeca(id) {
    if (confirm('Tem certeza que deseja excluir esta peça?')) {
        pecas = pecas.filter(p => p.id !== id);
        salvarPecas();
        renderizarPecas();
        showMessage('Peça excluída com sucesso!', 'success');
    }
}

function salvarPecas() {
    localStorage.setItem('pecas', JSON.stringify(pecas));
}

function formatarData(dataString) {
    const data = new Date(dataString + 'T00:00:00');
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
    div.innerHTML = `
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            ${type === 'success'
                ? '<polyline points="20 6 9 17 4 12"/>'
                : '<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>'
            }
        </svg>
        <span>${message}</span>
    `;

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
document.getElementById('btn-exportar').addEventListener('click', function() {
    window.print();
});

// ==================== CONFIGURAÇÃO ====================
function salvarConfig() {
    localStorage.setItem('clientes', JSON.stringify(clientes));
    localStorage.setItem('secretarias', JSON.stringify(secretarias));
    localStorage.setItem('tiposPeca', JSON.stringify(tiposPeca));
    atualizarDropdowns();
}

function atualizarDropdowns() {
    // Atualiza dropdown de clientes no cadastro
    const clienteSelect = document.getElementById('cliente');
    clienteSelect.innerHTML = '<option value="">Selecione um cliente</option>';
    clientes.forEach(cliente => {
        clienteSelect.innerHTML += `<option value="${cliente}">${cliente}</option>`;
    });

    // Atualiza dropdown de clientes no relatório
    const relClienteSelect = document.getElementById('rel-cliente');
    relClienteSelect.innerHTML = '<option value="">Todos os clientes</option>';
    clientes.forEach(cliente => {
        relClienteSelect.innerHTML += `<option value="${cliente}">${cliente}</option>`;
    });

    // Atualiza dropdown de clientes na configuração de secretarias
    const secClienteSelect = document.getElementById('secretaria-cliente');
    secClienteSelect.innerHTML = '<option value="">Selecione um cliente</option>';
    clientes.forEach(cliente => {
        secClienteSelect.innerHTML += `<option value="${cliente}">${cliente}</option>`;
    });

    // Atualiza dropdown de clientes no filtro de listagem
    const filterClienteSelect = document.getElementById('filter-cliente');
    filterClienteSelect.innerHTML = '<option value="">Todos os clientes</option>';
    clientes.forEach(cliente => {
        filterClienteSelect.innerHTML += `<option value="${cliente}">${cliente}</option>`;
    });

    // Atualiza dropdown de secretarias no filtro de listagem
    const filterSecretariaSelect = document.getElementById('filter-secretaria');
    filterSecretariaSelect.innerHTML = '<option value="">Todas as secretarias</option>';
    const todasSecretarias = new Set();
    Object.values(secretarias).forEach(secs => {
        secs.forEach(sec => todasSecretarias.add(sec));
    });
    todasSecretarias.forEach(secretaria => {
        filterSecretariaSelect.innerHTML += `<option value="${secretaria}">${secretaria}</option>`;
    });

    // Atualiza dropdown de tipos de peça
    const tipoPecaSelect = document.getElementById('tipo-peca');
    tipoPecaSelect.innerHTML = '<option value="">Selecione o tipo</option>';
    tiposPeca.forEach(tipo => {
        tipoPecaSelect.innerHTML += `<option value="${tipo}">${tipo}</option>`;
    });

    // Atualiza dropdown de tipos no filtro
    const filterTipoSelect = document.getElementById('filter-tipo');
    filterTipoSelect.innerHTML = '<option value="">Todos os tipos</option>';
    tiposPeca.forEach(tipo => {
        filterTipoSelect.innerHTML += `<option value="${tipo}">${tipo}</option>`;
    });
}

// Renderizar lista de clientes
function renderizarClientes() {
    const lista = document.getElementById('lista-clientes');
    lista.innerHTML = '';

    clientes.forEach((cliente, index) => {
        const item = document.createElement('div');
        item.className = 'config-item';
        item.innerHTML = `
            <div class="config-item-content">
                <div class="config-item-title">${cliente}</div>
                <div class="config-item-subtitle">${secretarias[cliente] ? secretarias[cliente].length : 0} secretaria(s)</div>
            </div>
            <div class="config-item-actions">
                <button class="btn-icon btn-icon-delete" onclick="deletarCliente('${cliente}')">
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
document.getElementById('btn-add-cliente').addEventListener('click', () => {
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

    clientes.push(nomeCliente);
    secretarias[nomeCliente] = [];
    salvarConfig();
    renderizarClientes();
    input.value = '';
    showMessage('Cliente adicionado com sucesso!', 'success');
});

// Deletar cliente
function deletarCliente(nomeCliente) {
    if (confirm(`Tem certeza que deseja excluir o cliente "${nomeCliente}"? Isso também excluirá todas as secretarias associadas.`)) {
        clientes = clientes.filter(c => c !== nomeCliente);
        delete secretarias[nomeCliente];
        salvarConfig();
        renderizarClientes();
        renderizarSecretarias();
        showMessage('Cliente excluído com sucesso!', 'success');
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
        const item = document.createElement('div');
        item.className = 'config-item';
        item.innerHTML = `
            <div class="config-item-content">
                <div class="config-item-title">${secretaria}</div>
                <div class="config-item-subtitle">${clienteSelecionado}</div>
            </div>
            <div class="config-item-actions">
                <button class="btn-icon btn-icon-delete" onclick="deletarSecretaria('${clienteSelecionado}', '${secretaria}')">
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
document.getElementById('btn-add-secretaria').addEventListener('click', () => {
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

    if (!secretarias[clienteSelecionado]) {
        secretarias[clienteSelecionado] = [];
    }

    if (secretarias[clienteSelecionado].includes(nomeSecretaria)) {
        showMessage('Secretaria já existe para este cliente!', 'error');
        return;
    }

    secretarias[clienteSelecionado].push(nomeSecretaria);
    salvarConfig();
    renderizarSecretarias();
    renderizarClientes();
    input.value = '';
    showMessage('Secretaria adicionada com sucesso!', 'success');
});

// Deletar secretaria
function deletarSecretaria(cliente, secretaria) {
    if (confirm(`Tem certeza que deseja excluir a secretaria "${secretaria}"?`)) {
        secretarias[cliente] = secretarias[cliente].filter(s => s !== secretaria);
        salvarConfig();
        renderizarSecretarias();
        renderizarClientes();
        showMessage('Secretaria excluída com sucesso!', 'success');
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
            secretariaSelect.innerHTML += `<option value="${secretaria}">${secretaria}</option>`;
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
            secretariaSelect.innerHTML += `<option value="${secretaria}">${secretaria}</option>`;
        });
    } else if (!clienteSelecionado) {
        // Mostra todas as secretarias de todos os clientes
        const todasSecretarias = new Set();
        Object.values(secretarias).forEach(secs => {
            secs.forEach(sec => todasSecretarias.add(sec));
        });
        todasSecretarias.forEach(secretaria => {
            secretariaSelect.innerHTML += `<option value="${secretaria}">${secretaria}</option>`;
        });
    }
});

// Renderizar lista de tipos de peça
function renderizarTiposPeca() {
    const lista = document.getElementById('lista-tipos');
    lista.innerHTML = '';

    tiposPeca.forEach(tipo => {
        const item = document.createElement('div');
        item.className = 'config-item';
        item.innerHTML = `
            <div class="config-item-content">
                <div class="config-item-title">${tipo}</div>
                <div class="config-item-subtitle">Disponível para todos os clientes</div>
            </div>
            <div class="config-item-actions">
                <button class="btn-icon btn-icon-delete" onclick="deletarTipoPeca('${tipo}')">
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
document.getElementById('btn-add-tipo').addEventListener('click', () => {
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

    tiposPeca.push(nomeTipo);
    salvarConfig();
    renderizarTiposPeca();
    input.value = '';
    showMessage('Tipo de peça adicionado com sucesso!', 'success');
});

// Deletar tipo de peça
function deletarTipoPeca(tipo) {
    if (confirm(`Tem certeza que deseja excluir o tipo "${tipo}"?`)) {
        tiposPeca = tiposPeca.filter(t => t !== tipo);
        salvarConfig();
        renderizarTiposPeca();
        showMessage('Tipo de peça excluído com sucesso!', 'success');
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

// Função para abrir modal de edição
function editarPeca(id) {
    const peca = pecas.find(p => p.id === id);
    if (!peca) return;

    // Preenche o ID
    document.getElementById('edit-id').value = peca.id;

    // Atualiza dropdowns de edição
    const editClienteSelect = document.getElementById('edit-cliente');
    editClienteSelect.innerHTML = '<option value="">Selecione um cliente</option>';
    clientes.forEach(cliente => {
        editClienteSelect.innerHTML += `<option value="${cliente}">${cliente}</option>`;
    });
    editClienteSelect.value = peca.cliente;

    // Atualiza dropdown de secretaria baseado no cliente
    const editSecretariaSelect = document.getElementById('edit-secretaria');
    editSecretariaSelect.innerHTML = '<option value="">Selecione uma secretaria</option>';
    if (secretarias[peca.cliente]) {
        secretarias[peca.cliente].forEach(secretaria => {
            editSecretariaSelect.innerHTML += `<option value="${secretaria}">${secretaria}</option>`;
        });
    }
    editSecretariaSelect.value = peca.secretaria;

    // Atualiza dropdown de tipo de peça
    const editTipoPecaSelect = document.getElementById('edit-tipo-peca');
    editTipoPecaSelect.innerHTML = '<option value="">Selecione o tipo</option>';
    tiposPeca.forEach(tipo => {
        editTipoPecaSelect.innerHTML += `<option value="${tipo}">${tipo}</option>`;
    });
    editTipoPecaSelect.value = peca.tipoPeca;

    // Preenche outros campos
    document.getElementById('edit-nome-peca').value = peca.nomePeca;
    document.getElementById('edit-data-criacao').value = peca.dataCriacao;
    document.getElementById('edit-data-veiculacao').value = peca.dataVeiculacao || '';
    document.getElementById('edit-observacao').value = peca.observacao || '';

    // Mostra preview da imagem atual
    editPreviewImage.src = peca.comprovacao;
    editFilePreview.style.display = 'block';
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
            editSecretariaSelect.innerHTML += `<option value="${secretaria}">${secretaria}</option>`;
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
    const pecaId = parseInt(document.getElementById('edit-id').value);
    const peca = pecas.find(p => p.id === pecaId);
    if (peca) {
        editPreviewImage.src = peca.comprovacao;
    }
});

// Fechar modal de edição
modalCloseEdit.addEventListener('click', () => {
    modalEdicao.classList.remove('active');
    formEdicao.reset();
    editArquivoSelecionado = null;
});

document.getElementById('btn-cancelar-edicao').addEventListener('click', () => {
    modalEdicao.classList.remove('active');
    formEdicao.reset();
    editArquivoSelecionado = null;
});

modalEdicao.addEventListener('click', (e) => {
    if (e.target === modalEdicao) {
        modalEdicao.classList.remove('active');
        formEdicao.reset();
        editArquivoSelecionado = null;
    }
});

// Salvar edição
formEdicao.addEventListener('submit', function(e) {
    e.preventDefault();

    const pecaId = parseInt(document.getElementById('edit-id').value);
    const pecaIndex = pecas.findIndex(p => p.id === pecaId);

    if (pecaIndex === -1) {
        showMessage('Peça não encontrada!', 'error');
        return;
    }

    // Atualiza os dados da peça
    pecas[pecaIndex].cliente = document.getElementById('edit-cliente').value;
    pecas[pecaIndex].secretaria = document.getElementById('edit-secretaria').value;
    pecas[pecaIndex].tipoPeca = document.getElementById('edit-tipo-peca').value;
    pecas[pecaIndex].nomePeca = document.getElementById('edit-nome-peca').value;
    pecas[pecaIndex].dataCriacao = document.getElementById('edit-data-criacao').value;
    pecas[pecaIndex].dataVeiculacao = document.getElementById('edit-data-veiculacao').value || null;
    pecas[pecaIndex].observacao = document.getElementById('edit-observacao').value || '';

    // Atualiza a imagem se foi selecionada uma nova
    if (editArquivoSelecionado) {
        pecas[pecaIndex].comprovacao = editPreviewImage.src;
    }

    // Salva no localStorage
    salvarPecas();

    // Fecha modal
    modalEdicao.classList.remove('active');
    formEdicao.reset();
    editArquivoSelecionado = null;

    // Atualiza listagem
    renderizarPecas();

    // Mensagem de sucesso
    showMessage('Peça atualizada com sucesso!', 'success');
});

// ==================== INICIALIZAÇÃO ====================
document.addEventListener('DOMContentLoaded', () => {
    // Define data atual nos campos de data
    const hoje = new Date().toISOString().split('T')[0];
    document.getElementById('data-criacao').value = hoje;
    document.getElementById('rel-data-inicio').value = hoje;
    document.getElementById('rel-data-fim').value = hoje;

    // Inicializa configurações
    atualizarDropdowns();
    renderizarClientes();
    renderizarSecretarias();
    renderizarTiposPeca();
});
