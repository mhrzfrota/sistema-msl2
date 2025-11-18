// Sistema de Gestão de Peças - MSL2
// Storage para armazenar as peças cadastradas
let pecas = JSON.parse(localStorage.getItem('pecas')) || [];

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

    const searchTerm = document.getElementById('search-pecas').value.toLowerCase();
    const filterTipo = document.getElementById('filter-tipo').value;
    const filterDataInicio = document.getElementById('filter-data-inicio').value;
    const filterDataFim = document.getElementById('filter-data-fim').value;

    if (searchTerm) {
        pecasFiltradas = pecasFiltradas.filter(peca =>
            peca.nomePeca.toLowerCase().includes(searchTerm) ||
            peca.cliente.toLowerCase().includes(searchTerm) ||
            peca.secretaria.toLowerCase().includes(searchTerm)
        );
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

    listaPecas.style.display = 'grid';
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
document.getElementById('search-pecas').addEventListener('input', renderizarPecas);
document.getElementById('filter-tipo').addEventListener('change', renderizarPecas);
document.getElementById('filter-data-inicio').addEventListener('change', renderizarPecas);
document.getElementById('filter-data-fim').addEventListener('change', renderizarPecas);

// Botão limpar filtros
document.getElementById('btn-limpar-filtros').addEventListener('click', function() {
    document.getElementById('search-pecas').value = '';
    document.getElementById('filter-tipo').value = '';
    document.getElementById('filter-data-inicio').value = '';
    document.getElementById('filter-data-fim').value = '';
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

// ==================== INICIALIZAÇÃO ====================
document.addEventListener('DOMContentLoaded', () => {
    // Define data atual nos campos de data
    const hoje = new Date().toISOString().split('T')[0];
    document.getElementById('data-criacao').value = hoje;
    document.getElementById('rel-data-inicio').value = hoje;
    document.getElementById('rel-data-fim').value = hoje;
});
