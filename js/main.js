import { fetchClients, fetchClient, saveClient, deleteClient, fetchUsers, saveUser, deleteUser } from './api.js';

document.addEventListener('DOMContentLoaded', async () => {

    // =================================================================================
    // DADOS MOCKADOS (Simulação de um banco de dados)
    // =================================================================================

    const STATUS_OPTIONS = ["Aprovado", "Engenharia", "Finalização", "Conformidade", "Assinado"];
    const FINAL_STATUSES = ["Assinado-Movido", "Arquivado"];

    const statusColorMap = {
        "Aprovado": "status-aprovado",
        "Engenharia": "status-engenharia",
        "Finalização": "status-finalização",
        "Conformidade": "status-conformidade",
        "Assinado": "status-assinado"
    };

    let activityLog = JSON.parse(localStorage.getItem('activityLog')) || [];

    // =================================================================================
    // SELETORES DE ELEMENTOS DOM
    // =================================================================================
    let statusPieChartInstance = null;
    const loginPage = document.getElementById('login-page');
    const appMenuView = document.getElementById('app-menu-view');
    const appStructure = document.getElementById('app-structure');
    const sidebar = document.getElementById('sidebar');
    const sidebarToggleBtn = document.getElementById('sidebar-toggle-btn');

    const loginForm = document.getElementById('login-form');
    const passwordInput = document.getElementById('password');
    const togglePasswordBtn = document.getElementById('toggle-password');
    
    const appCardDashboard = document.getElementById('app-card-dashboard');
    const appCardClients = document.getElementById('app-card-clients');
    const appCardCep = document.getElementById('app-card-cep');
    const appCardPdf = document.getElementById('app-card-pdf');
    const appCardReceipt = document.getElementById('app-card-receipt');
    const appCardSettings = document.getElementById('app-card-settings');

    const mainContent = document.getElementById('main-content');
    const pageTitle = document.getElementById('page-title');
    const views = {
        dashboard: document.getElementById('dashboard-view'),
        clients: document.getElementById('clients-view'),
        pdf: document.getElementById('pdf-editor-view'),
        cep: document.getElementById('cep-view'),
        receipt: document.getElementById('receipt-view'),
        settings: document.getElementById('settings-view'),
    };
    
    const navLinks = {
        appMenu: document.getElementById('nav-app-menu'),
        dashboard: document.getElementById('nav-dashboard'),
        clients: document.getElementById('nav-clients'),
        pdf: document.getElementById('nav-pdf'),
        receipt: document.getElementById('nav-receipt'),
        cep: document.getElementById('nav-cep'),
        settings: document.getElementById('nav-settings'),
    };

    const statsGrid = document.getElementById('stats-grid');
    const recentActivityList = document.getElementById('recent-activity-list');
    
    const clientsTableBody = document.getElementById('clients-table-body');
    const signedTableBody = document.getElementById('signed-table-body');
    const archivedTableBody = document.getElementById('archived-table-body');
    const usersTableBody = document.getElementById('users-table-body');
    
    const tabActive = document.getElementById('tab-active');
    const tabSigned = document.getElementById('tab-signed');
    const tabArchived = document.getElementById('tab-archived');
    const activeClientsContent = document.getElementById('active-clients-content');
    const signedClientsContent = document.getElementById('signed-clients-content');
    const archivedClientsContent = document.getElementById('archived-clients-content');

    const searchInput = document.getElementById('search-client');
    const filterStatus = document.getElementById('filter-status');
    const filterProfessional = document.getElementById('filter-professional');
    // Novos seletores para os filtros da aba de arquivados
    const searchArchivedInput = document.getElementById('search-archived-client');

    const filterProfessionalArchived = document.getElementById('filter-professional-archived');
    const filterArchiveMonth = document.getElementById('filter-archive-month');
    const filterArchiveYear = document.getElementById('filter-archive-year');

    const clientFormModal = document.getElementById('client-form-modal');
    const clientForm = document.getElementById('client-form');
    const formTitle = document.getElementById('form-title');
    const addClientBtn = document.getElementById('add-client-btn');
    const closeModalBtn = document.getElementById('close-modal-btn');
    const cancelFormBtn = document.getElementById('cancel-form-btn');
    
    const userFormModal = document.getElementById('user-form-modal');
    const userForm = document.getElementById('user-form');
    const userFormTitle = document.getElementById('user-form-title');
    const addUserBtn = document.getElementById('add-user-btn');
    const closeUserModalBtn = document.getElementById('close-user-modal-btn');
    const cancelUserFormBtn = document.getElementById('cancel-user-form-btn');

    const archiveConfirmModal = document.getElementById('archive-confirm-modal');
    const cancelArchiveBtn = document.getElementById('cancel-archive-btn');
    const confirmArchiveBtn = document.getElementById('confirm-archive-btn');
    
    const deleteUserConfirmModal = document.getElementById('delete-user-confirm-modal');
    const cancelDeleteUserBtn = document.getElementById('cancel-delete-user-btn');
    const confirmDeleteUserBtn = document.getElementById('confirm-delete-user-btn');

    const deleteClientConfirmModal = document.getElementById('delete-client-confirm-modal');
    const cancelDeleteClientBtn = document.getElementById('cancel-delete-client-btn');
    const confirmDeleteClientBtn = document.getElementById('confirm-delete-client-btn');

    const statusDropdownMenu = document.getElementById('status-dropdown-menu');
    
    const cepTabByCep = document.getElementById('cep-tab-by-cep');
    const cepTabByAddress = document.getElementById('cep-tab-by-address');
    const cepContentByCep = document.getElementById('cep-content-by-cep');
    const cepContentByAddress = document.getElementById('cep-content-by-address');
    const cepFormByCep = document.getElementById('cep-form-by-cep');
    const cepFormByAddress = document.getElementById('cep-form-by-address');
    const cepInput = document.getElementById('cep-input');
    const cepStreet = document.getElementById('cep-street');
    const cepCity = document.getElementById('cep-city');
    const cepState = document.getElementById('cep-state');
    const cepResults = document.getElementById('cep-results');

    // Seletores do Editor de PDF
    const pdfFileInputReplace = document.getElementById('pdf-file-input-replace');
    const pdfFileInputAppend = document.getElementById('pdf-file-input-append');
    const addMorePdfBtn = document.getElementById('add-more-pdf-btn');
    const clearPdfBtn = document.getElementById('clear-pdf-btn');
    const savePdfBtn = document.getElementById('save-pdf-btn');
    const pdfPagesPreview = document.getElementById('pdf-pages-preview');
    const pdfStatus = document.getElementById('pdf-status');

    // Seletores do Gerador de Recibos
    const empresaCnpj = document.getElementById('empresa-cnpj');
    const buscarCnpjBtn = document.getElementById('buscar-cnpj-btn');
    const empresaNome = document.getElementById('empresa-nome');
    const empresaEndereco = document.getElementById('empresa-endereco');
    const empresaCidade = document.getElementById('empresa-cidade');
    const empresaCep = document.getElementById('empresa-cep');
    const socioNome = document.getElementById('socio-nome');
    const socioFuncao = document.getElementById('socio-funcao');
    const mesReferencia = document.getElementById('mes-referencia');
    const salarioMinimo = document.getElementById('salario-minimo');
    const prolaboreBruto = document.getElementById('prolabore-bruto');
    const valorInss = document.getElementById('valor-inss');
    const percInss = document.getElementById('perc-inss');
    const valorIr = document.getElementById('valor-ir');
    const percIr = document.getElementById('perc-ir');
    const valorLiquido = document.getElementById('valor-liquido');
    const generatePdfBtn = document.getElementById('generate-pdf-btn');


    // =================================================================================
    // FUNÇÕES DE UI/UX (User Interface / User Experience)
    // =================================================================================

    /**
     * Renderiza um estado de "carregando" com linhas de esqueleto.
     * @param {HTMLElement} container O elemento (tbody) onde o loader será inserido.
     * @param {number} columns O número de colunas da tabela.
     * @param {number} rows O número de linhas de esqueleto a serem exibidas.
     */
    function renderSkeletonLoader(container, columns, rows = 5) {
        let skeletonHTML = '';
        for (let i = 0; i < rows; i++) {
            skeletonHTML += '<tr class="bg-white border-b">';
            for (let j = 0; j < columns; j++) {
                skeletonHTML += `
                    <td class="px-6 py-4">
                        <div class="h-4 bg-gray-200 rounded animate-pulse"></div>
                    </td>
                `;
            }
            skeletonHTML += '</tr>';
        }
        container.innerHTML = skeletonHTML;
    }

    /**
     * Renderiza uma mensagem de "estado vazio" para tabelas.
     * @param {HTMLElement} container O elemento (tbody) onde a mensagem será inserida.
     * @param {string} icon O HTML do ícone SVG.
     * @param {string} title O título da mensagem.
     * @param {string} subtitle O subtítulo ou descrição.
     * @param {number} colspan O número de colunas que a célula deve ocupar.
     */
    function renderEmptyState(container, icon, title, subtitle, colspan = 12) {
        container.innerHTML = `
            <tr>
                <td colspan="${colspan}" class="text-center p-10">
                    <div class="flex flex-col items-center text-gray-400 max-w-md mx-auto">
                        ${icon}
                        <h3 class="text-lg font-semibold text-gray-600 mt-4">${title}</h3>
                        <p class="text-sm">${subtitle}</p>
                    </div>
                </td>
            </tr>
        `;
    }

    /**
     * Exibe uma notificação toast na tela.
     * @param {string} message A mensagem a ser exibida.
     * @param {'success'|'error'} type O tipo de notificação.
     * @param {number} duration Duração em milissegundos.
     */
    function showToast(message, type = 'success', duration = 3000) {
        const container = document.getElementById('toast-container');
        if (!container) return;

        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        
        let iconHtml = '';
        if (type === 'success') {
            iconHtml = `<svg class="w-6 h-6 mr-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>`;
        } else if (type === 'error') {
            iconHtml = `<svg class="w-6 h-6 mr-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>`;
        }

        toast.innerHTML = `${iconHtml}<span>${message}</span>`;
        container.appendChild(toast);

        setTimeout(() => toast.classList.add('show'), 10);

        setTimeout(() => {
            toast.classList.remove('show');
            toast.addEventListener('transitionend', () => toast.remove());
        }, duration);
    }

    /**
     * Alterna o estado de carregamento de um botão.
     * @param {HTMLButtonElement} button O elemento do botão.
     * @param {boolean} isLoading Define se o estado é de carregamento.
     */
    function toggleButtonLoading(button, isLoading) {
        if (isLoading) {
            button.disabled = true;
            button.dataset.originalText = button.innerHTML;
            button.innerHTML = `<svg class="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>`;
        } else {
            button.disabled = false;
            button.innerHTML = button.dataset.originalText || 'Salvar';
        }
    }

    // =================================================================================
    // LÓGICA DO EDITOR DE PDF
    // =================================================================================
    let loadedPdfFiles = [];

    async function handlePdfFileSelection(event, append = false) {
        const files = event.target.files;
        const { pdfjsLib } = window;

        if (files.length === 0) return;

        if (!pdfjsLib) {
            pdfStatus.textContent = 'Erro: Biblioteca PDF não foi carregada.';
            console.error('PDF.js library (pdfjsLib) is not available.');
            return;
        }

        if (!append) {
            pdfPagesPreview.innerHTML = '';
            loadedPdfFiles = [];
        }

        pdfStatus.textContent = 'Carregando arquivos...';
        savePdfBtn.disabled = true; // Desabilita enquanto processa
        addMorePdfBtn.disabled = true;
        clearPdfBtn.disabled = true;

        // Configura o worker do PDF.js
        const initialFileIndex = loadedPdfFiles.length;
        pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js`;

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            pdfStatus.textContent = `Processando ${file.name}...`;
            
            const fileReader = new FileReader();
            const fileBuffer = await new Promise(resolve => {
                fileReader.onload = (e) => resolve(e.target.result);
                fileReader.readAsArrayBuffer(file);
            });

            loadedPdfFiles.push(fileBuffer);
            const pdfDoc = await pdfjsLib.getDocument({ data: fileBuffer }).promise;

            for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
                const page = await pdfDoc.getPage(pageNum);
                const viewport = page.getViewport({ scale: 0.5 });
                
                const pageContainer = document.createElement('div');
                pageContainer.className = 'p-1 border rounded-md shadow-sm cursor-grab bg-white relative group';
                pageContainer.dataset.fileIndex = initialFileIndex + i;
                pageContainer.dataset.pageIndex = pageNum - 1;

                const canvas = document.createElement('canvas');
                const context = canvas.getContext('2d');
                canvas.height = viewport.height;
                canvas.width = viewport.width;
                canvas.className = 'w-full h-auto';

                await page.render({ canvasContext: context, viewport: viewport }).promise;

                const pageLabel = document.createElement('span');
                pageLabel.className = 'absolute top-1 right-1 bg-primary text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center';

                const deleteBtn = document.createElement('button');
                deleteBtn.className = 'absolute top-1 left-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity';
                deleteBtn.innerHTML = '<i class="fa-solid fa-times fa-xs"></i>';
                deleteBtn.onclick = (e) => {
                    e.stopPropagation();
                    pageContainer.remove();
                    updatePageNumbers();
                    checkPdfState();
                };
                
                pageContainer.appendChild(canvas);
                pageContainer.appendChild(pageLabel);
                pageContainer.appendChild(deleteBtn);
                pdfPagesPreview.appendChild(pageContainer);
            }
        }

        updatePageNumbers();
        new Sortable(pdfPagesPreview, {
            animation: 150,
            ghostClass: 'bg-blue-100',
            onEnd: updatePageNumbers
        });

        pdfStatus.textContent = `${pdfPagesPreview.children.length} páginas carregadas. Arraste para reordenar.`;
        checkPdfState();
        pdfFileInputReplace.value = ''; // Limpa os inputs para permitir selecionar o mesmo arquivo novamente
        pdfFileInputAppend.value = '';
    }

    function checkPdfState() {
        const hasPages = pdfPagesPreview.children.length > 0;
        savePdfBtn.disabled = !hasPages;
        addMorePdfBtn.disabled = !hasPages;
        clearPdfBtn.disabled = !hasPages;
    }

    function clearAllPdfPages() {
        pdfPagesPreview.innerHTML = '';
        loadedPdfFiles = [];
        pdfStatus.textContent = '';
        checkPdfState();
    }

    function updatePageNumbers() {
        const pages = pdfPagesPreview.children;
        for (let i = 0; i < pages.length; i++) {
            pages[i].querySelector('span').textContent = i + 1;
        }
    }

    async function saveMergedPdf() {
        pdfStatus.textContent = 'Criando novo PDF... Isso pode levar um momento.';
        savePdfBtn.disabled = true;
        clearPdfBtn.disabled = true;

        const { PDFDocument } = PDFLib;
        const mergedPdf = await PDFDocument.create();
        const pageElements = Array.from(pdfPagesPreview.children);

        for (const pageElement of pageElements) {
            const fileIndex = parseInt(pageElement.dataset.fileIndex);
            const pageIndex = parseInt(pageElement.dataset.pageIndex);
            const rotation = parseInt(pageElement.dataset.rotation || '0');

            if (!loadedPdfFiles[fileIndex]) continue; // Segurança

            const sourcePdfDoc = await PDFDocument.load(loadedPdfFiles[fileIndex]);
            const [copiedPage] = await mergedPdf.copyPages(sourcePdfDoc, [pageIndex]);
            mergedPdf.addPage(copiedPage);
        }

        // A compressão avançada não é trivial no cliente.
        // O pdf-lib por padrão já otimiza o arquivo ao salvar.
        const pdfBytes = await mergedPdf.save({ useObjectStreams: true });

        const blob = new Blob([pdfBytes], { type: 'application/pdf' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `documento_unificado_${Date.now()}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        pdfStatus.textContent = 'PDF salvo com sucesso!';
        showToast('PDF combinado salvo com sucesso!', 'success');
        checkPdfState();
    }

    // =================================================================================
    // LÓGICA DO GERADOR DE RECIBOS
    // =================================================================================
    // --- LÓGICA DE CÁLCULO DE IMPOSTOS (VIGÊNCIA 2025) ---
    const SALARIO_MINIMO_2025 = 1518.00;
    const TETO_INSS_2025 = 8157.41;
    const ALIQUOTA_INSS_PROLABORE = 0.11;

    const TABELA_IRPF_2025 = [
        { max: 2428.80, rate: 0, deduction: 0 },
        { max: 2826.65, rate: 0.075, deduction: 182.16 },
        { max: 3751.05, rate: 0.15, deduction: 394.16 },
        { max: 4664.68, rate: 0.225, deduction: 675.49 },
        { max: Infinity, rate: 0.275, deduction: 908.73 }
    ];

    const formatarMoeda = (valor) => {
        if (typeof valor !== 'number' || isNaN(valor)) return '0,00';
        return valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };

    const formatCNPJ = (cnpj) => {
        return cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
    };

    const calcularINSS = (baseCalculo) => {
        const salarioMinimo = SALARIO_MINIMO_2025;
        if (baseCalculo < salarioMinimo) {
            // Se o pró-labore for menor que o mínimo, o INSS é sobre o mínimo
            const valorINSS = salarioMinimo * ALIQUOTA_INSS_PROLABORE;
            const aliquotaEfetiva = (baseCalculo > 0) ? (valorINSS / baseCalculo) * 100 : 0;
            return { valor: valorINSS, aliquotaEfetiva: aliquotaEfetiva };
        }
        // Para valores acima do mínimo, calcula sobre o valor ou o teto
        const baseContribuicao = Math.min(baseCalculo, TETO_INSS_2025);
        const valorINSS = baseContribuicao * ALIQUOTA_INSS_PROLABORE;
        // A alíquota efetiva é o valor do INSS dividido pelo pró-labore bruto
        const aliquotaEfetiva = (baseCalculo > 0) ? (valorINSS / baseCalculo) * 100 : 0;
        return { valor: valorINSS, aliquotaEfetiva: aliquotaEfetiva };
    };

    const calcularIR = (baseCalculoIR) => {
        for (const faixa of TABELA_IRPF_2025) {
            if (baseCalculoIR <= faixa.max) {
                const valorIR = (baseCalculoIR * faixa.rate) - faixa.deduction;
                return { valor: Math.max(0, valorIR), aliquota: faixa.rate * 100 };
            }
        }
        return { valor: 0, aliquota: 0 };
    };

    const atualizarCalculos = () => {
        const prolaboreBrutoValue = parseFloat(prolaboreBruto.value) || 0;
        if (prolaboreBrutoValue <= 0) {
            valorInss.value = ''; percInss.value = '';
            valorIr.value = ''; percIr.value = '';
            valorLiquido.value = '';
            return;
        }
        const inss = calcularINSS(prolaboreBrutoValue);
        const baseCalculoIR = prolaboreBrutoValue - inss.valor;
        const ir = calcularIR(baseCalculoIR);
        const liquido = prolaboreBrutoValue - inss.valor - ir.valor;
        
        valorInss.value = formatarMoeda(inss.valor);
        percInss.value = `${formatarMoeda(inss.aliquotaEfetiva)}%`;
        valorIr.value = formatarMoeda(ir.valor);
        percIr.value = `${formatarMoeda(ir.aliquota)}%`;
        valorLiquido.value = formatarMoeda(liquido);
    };

    const buscarDadosCNPJ = async () => {
        const cnpj = empresaCnpj.value.replace(/\D/g, '');
        if (cnpj.length !== 14) {
            showToast('CNPJ inválido. Digite 14 números.', 'error');
            return;
        }

        toggleButtonLoading(buscarCnpjBtn, true);
        try {
            const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`);
            if (!response.ok) {
                throw new Error('Não foi possível buscar os dados do CNPJ.');
            }
            const data = await response.json();
            empresaNome.value = data.razao_social || '';
            empresaEndereco.value = `${data.logradouro || ''}, ${data.numero || ''}`;
            empresaCidade.value = `${data.municipio || ''} / ${data.uf || ''}`;
            empresaCep.value = data.cep || '';
            showToast('Dados da empresa preenchidos.', 'success');
        } catch (error) {
            showToast(error.message, 'error');
        } finally {
            toggleButtonLoading(buscarCnpjBtn, false);
        }
    };

    const initReceiptGenerator = () => {
        // Define o salário mínimo
        salarioMinimo.value = formatarMoeda(SALARIO_MINIMO_2025);
    
        // Define Mês/Ano de referência
        const meses = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
        const dataAtual = new Date();
        const mes = meses[dataAtual.getMonth()];
        const ano = dataAtual.getFullYear();
        mesReferencia.value = `${mes}/${ano}`;
    
        // Dispara o cálculo inicial
        atualizarCalculos();
    };

    // =================================================================================
    // FUNÇÕES GERAIS E DE RENDERIZAÇÃO
    // =================================================================================
    // Função de navegação atualizada para gerenciar o padding
    function navigateTo(viewName) {
        Object.values(views).forEach(v => v.classList.add('hidden'));
        views[viewName].classList.remove('hidden');

        pageTitle.textContent = {
            dashboard: 'Dashboard',
            clients: 'Clientes',
            pdf: 'Editor de PDF',
            cep: 'Buscador de CEP',
            receipt: 'Gerador de Recibos',
            settings: 'Configurações'
        }[viewName];
        
        Object.values(navLinks).forEach(link => link.classList.remove('bg-gray-700', 'text-white'));
        const activeLink = navLinks[viewName];
        if (activeLink) activeLink.classList.add('bg-gray-700', 'text-white');
        
        mainContent.classList.add('p-6');
        
        if (viewName === 'dashboard') renderDashboard();
        if (viewName === 'clients') showActiveTab();
        if (viewName === 'settings') renderUsersTable();
        if (viewName === 'receipt') initReceiptGenerator();
    }
    
    async function renderDashboard() {
        let statusCounts = {};
        try {
            const clients = await fetchClients();
            statusCounts = clients.reduce((acc, client) => {
                if (!FINAL_STATUSES.includes(client.status)) {
                    acc[client.status] = (acc[client.status] || 0) + 1;
                }
                return acc;
            }, {});
        } catch (error) {
            console.error("Erro ao renderizar dashboard:", error);
        }

        statsGrid.innerHTML = '';
        STATUS_OPTIONS.filter(s => !FINAL_STATUSES.includes(s)).forEach(status => {
            const count = statusCounts[status] || 0;
            const colorClass = statusColorMap[status];
            const card = `
                <div class="bg-surface p-4 rounded-lg shadow-md flex items-center">
                    <div class="p-3 rounded-full ${colorClass} mr-4">
                        <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"></path></svg>
                    </div>
                    <div>
                        <div class="text-3xl font-bold text-secondary">${count}</div>
                        <div class="text-sm text-text-secondary">${status}</div>
                    </div>
                </div>
            `;
            statsGrid.innerHTML += card;
        });
        await renderStatusPieChart();

        recentActivityList.innerHTML = '';
        if (activityLog.length === 0) {
            recentActivityList.innerHTML = `<li class="p-4 text-center text-gray-500">Nenhuma atividade recente.</li>`;
            return;
        }
        activityLog.slice(0, 5).forEach(log => {
            const item = `
                <li class="p-4 flex justify-between items-center hover:bg-gray-50">
                    <div>
                        <p class="font-medium text-sm text-secondary">${log.clientName}</p>
                        <p class="text-xs text-text-secondary">${log.action}</p>
                    </div>
                    <span class="text-xs text-gray-400">${formatTimeAgo(log.timestamp)}</span>
                </li>
            `;
            recentActivityList.innerHTML += item;
        });
    }

    /**
     * Formata uma string de CPF para o padrão 000.000.000-00.
     * @param {string} cpf O CPF a ser formatado (pode conter ou não a máscara).
     * @returns {string} O CPF formatado.
     */
    function formatCPF(cpf) {
        if (!cpf) return '';
        let value = cpf.toString().replace(/\D/g, ''); // Remove tudo que não é dígito
        value = value.substring(0, 11); // Limita a 11 caracteres

        value = value.replace(/(\d{3})(\d)/, '$1.$2');
        value = value.replace(/(\d{3})\.(\d{3})(\d)/, '$1.$2.$3');
        value = value.replace(/(\d{3})\.(\d{3})\.(\d{3})(\d{1,2})/, '$1.$2.$3-$4');
        return value;
    }

    // O resto das suas funções (renderDashboard, updateStatusBadge, etc.)
    // continuam aqui...
    function logActivity(clientName, action) {
        activityLog.unshift({ clientName, action, timestamp: new Date().toISOString() });
        activityLog = activityLog.slice(0, 5);
        localStorage.setItem('activityLog', JSON.stringify(activityLog));
    }

    function formatTimeAgo(date) {
        const dateObj = typeof date === 'string' ? new Date(date) : date;
        const seconds = Math.floor((new Date() - dateObj) / 1000);
        let interval = seconds / 31536000;
        if (interval > 1) return Math.floor(interval) + " anos atrás";
        interval = seconds / 2592000;
        if (interval > 1) return Math.floor(interval) + " meses atrás";
        interval = seconds / 86400;
        if (interval > 1) return Math.floor(interval) + " dias atrás";
        interval = seconds / 3600;
        if (interval > 1) return Math.floor(interval) + " horas atrás";
        interval = seconds / 60;
        if (interval > 1) return Math.floor(interval) + " minutos atrás";
        return "agora mesmo";
    }

    async function renderStatusPieChart() {
        const ctx = document.getElementById('status-pie-chart')?.getContext('2d');
        if (!ctx) return;

        let statusCounts = {};
        try {
            const clients = await fetchClients();
            const activeClients = clients.filter(client => !FINAL_STATUSES.includes(client.status));
            statusCounts = activeClients.reduce((acc, client) => {
                acc[client.status] = (acc[client.status] || 0) + 1;
                return acc;
            }, {});
        } catch (error) {
            console.error("Erro ao renderizar gráfico:", error);
        }

        const labels = Object.keys(statusCounts);
        const data = Object.values(statusCounts);

        // Cores mais vibrantes para o gráfico
        const chartColors = {
            "Aprovado": "#A8A29E",       // Cinza/Pedra
            "Engenharia": "#F87171",     // Vermelho
            "Finalização": "#FBBF24",    // Amarelo/Âmbar
            "Conformidade": "#4ADE80",   // Verde
            "Assinado": "#60A5FA"        // Azul
        };

        const backgroundColors = labels.map(label => chartColors[label] || '#CCCCCC');

        // Destrói o gráfico anterior para evitar sobreposição e vazamento de memória
        if (statusPieChartInstance) {
            statusPieChartInstance.destroy();
        }

        statusPieChartInstance = new Chart(ctx, {
            type: 'pie',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Clientes',
                    data: data,
                    backgroundColor: backgroundColors,
                    borderColor: '#FFFFFF',
                    borderWidth: 2
                }]
            },
            options: { responsive: true, maintainAspectRatio: false }
        });
    }

    function updateStatusBadge(badgeElement, status) {
        badgeElement.querySelector('span').textContent = status;
        Object.values(statusColorMap).forEach(cls => badgeElement.classList.remove(cls));
        const colorClass = statusColorMap[status];
        if (colorClass) badgeElement.classList.add(colorClass);
    }
    
    async function showActiveTab() {
        activeClientsContent.classList.remove('hidden');
        signedClientsContent.classList.add('hidden');
        archivedClientsContent.classList.add('hidden');
        tabActive.classList.add('border-primary', 'text-primary');
        tabActive.classList.remove('border-transparent', 'text-gray-500');
        tabSigned.classList.add('border-transparent', 'text-gray-500');
        tabSigned.classList.remove('border-primary', 'text-primary');
        tabArchived.classList.add('border-transparent', 'text-gray-500');
        tabArchived.classList.remove('border-primary', 'text-primary');
        await renderClientsTable();
    }

    async function showSignedTab() {
        activeClientsContent.classList.add('hidden');
        signedClientsContent.classList.remove('hidden');
        archivedClientsContent.classList.add('hidden');
        tabActive.classList.remove('border-primary', 'text-primary');
        tabActive.classList.add('border-transparent', 'text-gray-500');
        tabSigned.classList.add('border-primary', 'text-primary');
        tabSigned.classList.remove('border-transparent', 'text-gray-500');
        tabArchived.classList.add('border-transparent', 'text-gray-500');
        tabArchived.classList.remove('border-primary', 'text-primary');
        await renderSignedTable();
    }

    async function showArchivedTab() {
        activeClientsContent.classList.add('hidden');
        signedClientsContent.classList.add('hidden');
        archivedClientsContent.classList.remove('hidden');
        tabArchived.classList.add('border-primary', 'text-primary');
        tabArchived.classList.remove('border-transparent', 'text-gray-500');
        tabActive.classList.add('border-transparent', 'text-gray-500');
        tabActive.classList.remove('border-primary', 'text-primary');
        tabSigned.classList.add('border-transparent', 'text-gray-500');
        tabSigned.classList.remove('border-primary', 'text-primary');
        await renderArchivedTable();
    }
    
    async function populateFilters() {
        filterStatus.innerHTML = '<option value="">Todos os Status</option>';
        STATUS_OPTIONS.forEach(status => {
            const option = document.createElement('option');
            option.value = status;
            option.textContent = status;
            filterStatus.appendChild(option);
        });
        
        try {
            const allClients = await fetchClients();
            
            // Lógica para popular o filtro unificado de profissionais (Corretor + Responsável)
            const corretores = allClients.map(c => c.corretor).filter(Boolean);
            const responsaveis = allClients.map(c => c.responsavel).filter(Boolean);
            const allProfessionals = [...new Set([...corretores, ...responsaveis])].sort();

            // Popula os dois selects (ativos e arquivados)
            filterProfessional.innerHTML = '<option value="">Todos os Profissionais</option>';
            filterProfessionalArchived.innerHTML = '<option value="">Todos os Profissionais</option>';

            allProfessionals.forEach(professional => {
                const option = document.createElement('option');
                option.value = professional;
                option.textContent = professional;
                filterProfessional.appendChild(option.cloneNode(true));
                filterProfessionalArchived.appendChild(option.cloneNode(true));
            });

            // Reutiliza os dados dos clientes para os filtros de arquivados
            const meses = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
            filterArchiveMonth.innerHTML = '<option value="">Todos os Meses</option>';
            meses.forEach((mes, index) => {
                const option = document.createElement('option');
                option.value = index + 1;
                option.textContent = mes;
                filterArchiveMonth.appendChild(option);
            });

            filterArchiveYear.innerHTML = '<option value="">Todos os Anos</option>';
            const anos = [...new Set(allClients.filter(c => c.dataAssinaturaContrato).map(c => new Date(c.dataAssinaturaContrato).getFullYear()))].sort().reverse();
            anos.forEach(ano => {
                const option = document.createElement('option');
                option.value = ano;
                option.textContent = ano;
                filterArchiveYear.appendChild(option);
            });

        } catch (error) {
            console.error("Erro ao popular filtros:", error);
            filterProfessional.innerHTML = '<option value="">Falha ao carregar</option>';
        }
    }

    function getDayCounter(creationDate) {
        const today = new Date();
        const created = new Date(creationDate);
        const diffTime = Math.abs(today - created);
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

        let colorClass = '';
        if (diffDays < 10) colorClass = 'bg-green-100 text-green-800';
        else if (diffDays < 20) colorClass = 'bg-yellow-100 text-yellow-800';
        else if (diffDays < 30) colorClass = 'bg-orange-100 text-orange-800';
        else colorClass = 'bg-red-100 text-red-800';
        
        return {
            days: diffDays.toString().padStart(2, '0'),
            color: colorClass
        };
    }

    /**
     * Função genérica para renderizar tabelas de clientes.
     * @param {object} config - Objeto de configuração.
     * @param {HTMLElement} config.tbody - O elemento tbody da tabela.
     * @param {function(object[]): object[]} config.filterFn - Função que recebe todos os clientes e retorna os filtrados.
     * @param {function(object): string} config.rowBuilderFn - Função que recebe um cliente e retorna o HTML da linha (tr).
     * @param {object} config.emptyState - Objeto com { icon, title, subtitle } para o estado vazio.
     * @param {number} config.columns - Número de colunas para o skeleton loader.
     */
    async function renderGenericClientTable(config) {
        const { tbody, filterFn, rowBuilderFn, emptyState, columns } = config;

        renderSkeletonLoader(tbody, columns);

        try {
            const allClients = await fetchClients();
            const filteredClients = filterFn(allClients);

            tbody.innerHTML = '';
            if (filteredClients.length === 0) {
                renderEmptyState(tbody, emptyState.icon, emptyState.title, emptyState.subtitle, columns);
                return;
            }

            filteredClients.forEach(client => {
                const row = document.createElement('tr');
                row.className = 'bg-white border-b';
                row.innerHTML = rowBuilderFn(client);
                tbody.appendChild(row);

                // Atualiza o badge de status se ele existir na linha
                const statusBadge = row.querySelector('.status-badge');
                if (statusBadge) {
                    updateStatusBadge(statusBadge, client.status);
                }
            });
        } catch (error) {
            console.error(`Erro ao renderizar tabela (${tbody.id}):`, error);
            const icon = `<svg class="w-16 h-16 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>`;
            renderEmptyState(tbody, icon, 'Falha ao carregar dados', 'Verifique a conexão com o servidor e tente novamente.', columns);
        }
    }

    async function renderClientsTable() {
        const filterFn = (allClients) => {
            const searchTerm = searchInput.value.toLowerCase();
          const statusFilter = filterStatus.value;
          const professionalFilter = filterProfessional.value;
            return allClients.filter(client =>
                !FINAL_STATUSES.includes(client.status) &&
                (client.nome.toLowerCase().includes(searchTerm) || (searchTerm.replace(/\D/g, '').length > 0 && client.cpf && client.cpf.includes(searchTerm.replace(/\D/g, '')))) &&
                (statusFilter === '' || client.status === statusFilter) &&
                (professionalFilter === '' || client.corretor === professionalFilter || client.responsavel === professionalFilter)
            );
        };

        const rowBuilderFn = (client) => {
            const dayCounter = getDayCounter(client.createdAt);
            return `
                <td class="px-6 py-4 font-medium text-gray-900 whitespace-nowrap">${client.nome}</td>
                <td class="px-6 py-4">${formatCPF(client.cpf || '')}</td>
                <td class="px-6 py-4">${client.imovel}</td>
                <td class="px-6 py-4">${client.corretor}</td>
                <td class="px-6 py-4">${client.responsavel || ''}</td>
                <td class="px-6 py-4">${client.agencia || ''}</td>
                <td class="px-6 py-4">${client.modalidade || ''}</td>
                <td class="px-6 py-4">
                    <div class="relative">
                        <button data-id="${client.id}" class="status-badge text-xs font-medium px-3 py-1.5 rounded-full w-full text-left flex justify-between items-center">
                            <span>${client.status}</span>
                            <svg class="w-3 h-3 text-gray-500 ml-2 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
                        </button>
                    </div>
                </td>
                <td class="px-6 py-4 text-center">
                    <span class="text-sm font-bold px-2.5 py-1 rounded-full ${dayCounter.color}">${dayCounter.days}</span>
                </td>
                <td class="px-6 py-4">
                    <input type="date" data-id="${client.id}" class="signature-date-input form-input text-xs p-1 rounded-md" value="${client.dataAssinaturaContrato ? client.dataAssinaturaContrato.split('T')[0] : ''}">
                </td>
                <td class="px-6 py-4 text-center space-x-3 whitespace-nowrap">
                    <button data-id="${client.id}" class="edit-btn font-medium text-primary hover:underline">Detalhes</button>
                    <button data-id="${client.id}" class="delete-client-btn font-medium text-red-600 hover:underline">Excluir</button>
                    <button data-id="${client.id}" class="sign-btn py-1 px-3 rounded-md shadow-sm text-xs font-medium btn-primary disabled:bg-gray-300 disabled:cursor-not-allowed" ${!client.dataAssinaturaContrato ? 'disabled' : ''}>Assinado</button>
                </td>
            `;
        };

        await renderGenericClientTable({
            tbody: clientsTableBody,
            filterFn,
            rowBuilderFn,
            emptyState: {
                icon: `<svg class="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"></path></svg>`,
                title: 'Nenhum cliente encontrado',
                subtitle: 'Tente ajustar seus filtros ou adicione um novo cliente.'
            },
            columns: 11
        });
    }

    async function renderSignedTable() {
        const filterFn = (allClients) => allClients.filter(client => client.status === 'Assinado-Movido');

        const rowBuilderFn = (client) => {
            const dayCounter = getDayCounter(client.createdAt);
            return `
                <td class="px-6 py-4 font-medium text-gray-900 whitespace-nowrap">${client.nome}</td>
                <td class="px-6 py-4">${formatCPF(client.cpf || '')}</td>
                <td class="px-6 py-4">${client.imovel}</td>
                <td class="px-6 py-4">${client.corretor}</td>
                <td class="px-6 py-4">${client.responsavel || ''}</td>
                <td class="px-6 py-4">${client.agencia || ''}</td>
                <td class="px-6 py-4">${client.modalidade || ''}</td>
                <td class="px-6 py-4">
                    <span class="status-badge text-xs font-medium px-3 py-1.5 rounded-full">
                        <span>Assinado</span>
                    </span>
                </td>
                <td class="px-6 py-4 text-center">
                    <span class="text-sm font-bold px-2.5 py-1 rounded-full ${dayCounter.color}">${dayCounter.days}</span>
                </td>
                <td class="px-6 py-4">${client.dataAssinaturaContrato ? new Date(client.dataAssinaturaContrato).toLocaleDateString('pt-BR') : ''}</td>
                <td class="px-6 py-4 text-center space-x-3 whitespace-nowrap">
                    <button data-id="${client.id}" class="edit-btn font-medium text-primary hover:underline">Detalhes</button>
                    <button data-id="${client.id}" class="archive-btn py-1 px-3 rounded-md shadow-sm text-xs font-medium btn-primary">Arquivar</button>
                </td>
            `;
        };

        await renderGenericClientTable({
            tbody: signedTableBody,
            filterFn,
            rowBuilderFn,
            emptyState: {
                icon: `<svg class="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>`,
                title: 'Nenhum cliente assinado',
                subtitle: 'Clientes com data de assinatura preenchida aparecerão aqui.'
            },
            columns: 11
        });
    }
    
    async function renderArchivedTable() {
        const filterFn = (allClients) => {
            const searchTerm = searchArchivedInput.value.toLowerCase();
            const professionalFilter = filterProfessionalArchived.value;
            const monthFilter = filterArchiveMonth.value;
            const yearFilter = filterArchiveYear.value;

            return allClients.filter(client => {
                const signatureDate = client.dataAssinaturaContrato ? new Date(client.dataAssinaturaContrato) : null;
                return client.status === 'Arquivado' &&
                    (client.nome.toLowerCase().includes(searchTerm) || (client.cpf && client.cpf.includes(searchTerm.replace(/\D/g, '')))) &&
                    (professionalFilter === '' || client.corretor === professionalFilter || client.responsavel === professionalFilter) &&
                    (monthFilter === '' || (signatureDate && signatureDate.getMonth() + 1 == monthFilter)) &&
                    (yearFilter === '' || (signatureDate && signatureDate.getFullYear() == yearFilter));
            });
        };

        const rowBuilderFn = (client) => {
                let durationDays = 'N/A';
                let durationColor = 'bg-gray-100 text-gray-800';
                let signatureDateFormatted = 'N/A';

                if (client.dataAssinaturaContrato) {
                    const dateParts = client.dataAssinaturaContrato.split('T')[0].split('-');
                    if (dateParts.length === 3) {
                        const year = parseInt(dateParts[0], 10);
                        const month = parseInt(dateParts[1], 10) - 1;
                        const day = parseInt(dateParts[2], 10);
                        const signed = new Date(year, month, day);

                        if (!isNaN(signed.getTime())) {
                            signatureDateFormatted = signed.toLocaleDateString('pt-BR');
                            
                            if (client.createdAt) {
                                const created = new Date(client.createdAt);
                                if (!isNaN(created.getTime())) {
                                    const diffTime = Math.abs(signed - created);
                                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                                    
                                    if (!isNaN(diffDays)) {
                                        durationDays = diffDays.toString().padStart(2, '0');
                                        if (diffDays < 30) durationColor = 'bg-green-100 text-green-800';
                                        else if (diffDays < 60) durationColor = 'bg-yellow-100 text-yellow-800';
                                        else durationColor = 'bg-red-100 text-red-800';
                                    }
                                }
                            }
                        }
                    }
                }

                return `
                    <td class="px-6 py-4 font-medium text-gray-900 whitespace-nowrap">${client.nome}</td>
                    <td class="px-6 py-4">${client.corretor}</td>
                    <td class="px-6 py-4">${formatCPF(client.cpf || '')}</td>
                    <td class="px-6 py-4">${client.imovel}</td>
                    <td class="px-6 py-4">${client.responsavel || ''}</td>
                    <td class="px-6 py-4">${client.agencia || ''}</td>
                    <td class="px-6 py-4">${client.modalidade || ''}</td>
                    <td class="px-6 py-4">
                        <span class="status-badge text-xs font-medium px-3 py-1.5 rounded-full">
                            <span>${client.status}</span>
                        </span>
                    </td>
                    <td class="px-6 py-4 text-center">
                        <span class="text-sm font-bold px-2.5 py-1 rounded-full ${durationColor}">${durationDays}</span>
                    </td>
                    <td class="px-6 py-4">${signatureDateFormatted}</td>
                    <td class="px-6 py-4 text-center space-x-3 whitespace-nowrap">
                        <button data-id="${client.id}" class="edit-btn font-medium text-primary hover:underline">Detalhes</button>
                        <button data-id="${client.id}" class="restore-client-btn font-medium text-green-600 hover:underline">Restaurar</button>
                        <button data-id="${client.id}" class="delete-client-btn font-medium text-red-600 hover:underline">Excluir</button>
                    </td>
                `;
        };

        await renderGenericClientTable({
            tbody: archivedTableBody,
            filterFn,
            rowBuilderFn,
            emptyState: {
                icon: `<svg class="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"></path></svg>`,
                title: 'Nenhum cliente arquivado encontrado',
                subtitle: 'Ajuste os filtros ou verifique se há clientes com status final.'
            },
            columns: 11
        });
    }
    
    async function renderUsersTable() {
        renderSkeletonLoader(usersTableBody, 4);

        try {
            const users = await fetchUsers();
            usersTableBody.innerHTML = '';

            if (users.length === 0) {
                const icon = `<svg class="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path></svg>`;
                renderEmptyState(usersTableBody, icon, 'Nenhum usuário cadastrado', 'Adicione o primeiro usuário da sua equipe clicando no botão acima.', 4);
                return;
            }

            users.forEach(user => {
                const row = document.createElement('tr');
                row.className = 'bg-white border-b';
                const roleClass = user.role === 'Administrador' ? 'bg-primary/20 text-primary' : 'bg-gray-200 text-gray-800';
                row.innerHTML = `
                    <td class="px-6 py-4 font-medium text-gray-900 whitespace-nowrap">${user.nome}</td>
                    <td class="px-6 py-4">${user.email}</td>
                    <td class="px-6 py-4">
                        <span class="text-xs font-medium px-2.5 py-0.5 rounded ${roleClass}">${user.role}</span>
                    </td>
                    <td class="px-6 py-4 text-center space-x-4 whitespace-nowrap">
                        <button data-id="${user.id}" class="edit-user-btn font-medium text-primary hover:underline">Editar</button>
                        <button data-id="${user.id}" class="delete-user-btn font-medium text-red-600 hover:underline">Excluir</button>
                    </td>
                `;
                usersTableBody.appendChild(row);
            });
        } catch (error) {
            console.error("Erro ao renderizar tabela de usuários:", error);
            const icon = `<svg class="w-16 h-16 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>`;
            renderEmptyState(usersTableBody, icon, 'Falha ao carregar usuários', 'Verifique a conexão com o servidor e tente novamente.', 4);
        }
    }
    
    async function openFormModal(clientId = null) {
        clientForm.reset();
        if (clientId) {
            try {
                const client = await fetchClient(clientId);
                formTitle.textContent = 'Editar Detalhes do Cliente';
                document.getElementById('client-id').value = client.id;
                document.getElementById('nome').value = client.nome;            
                document.getElementById('cpf').value = formatCPF(client.cpf || '');
                document.getElementById('imovel').value = client.imovel;
                document.getElementById('corretor').value = client.corretor;
                document.getElementById('responsavel').value = client.responsavel;
                document.getElementById('agencia').value = client.agencia || '';
                document.getElementById('modalidade').value = client.modalidade || '';
                document.getElementById('observacoes').value = client.observacoes;
            } catch (error) {
                showToast('Erro ao carregar dados do cliente.', 'error');
                return;
            }
        } else {
            formTitle.textContent = 'Adicionar Novo Cliente';
            document.getElementById('client-id').value = '';
        }
        clientFormModal.classList.remove('hidden');
    }

    function closeFormModal() {
        clientFormModal.classList.add('hidden');
    }

    async function handleFormSubmit(event) {
        event.preventDefault();
        const id = document.getElementById('client-id').value;
        const cpfValue = document.getElementById('cpf').value.replace(/\D/g, '');
        const agenciaValue = document.getElementById('agencia').value.replace(/\D/g, '');
        
        const clientData = {
            nome: document.getElementById('nome').value,
            cpf: cpfValue || null, // Envia null se a string for vazia
            imovel: document.getElementById('imovel').value,
            corretor: document.getElementById('corretor').value,
            responsavel: document.getElementById('responsavel').value,
            agencia: agenciaValue || null, // Envia null se a string for vazia
            modalidade: document.getElementById('modalidade').value,
            observacoes: document.getElementById('observacoes').value,
            status: 'Aprovado', // <<<< ADICIONE ESTA LINHA
        };

        if (id) {
            clientData.id = id;
        }

        try {
            const savedClient = await saveClient(clientData);
            logActivity(savedClient.nome, id ? 'Dados atualizados' : 'Cliente adicionado');
            
            closeFormModal();
            showToast('Cliente salvo com sucesso!', 'success');
            await renderClientsTable();
            await populateFilters(); 
        } catch (error) {
            console.error('Erro ao salvar cliente:', error);
            showToast('Não foi possível salvar o cliente. Tente novamente.', 'error');
        }
    }
    
    async function openUserFormModal(userId = null) {
        userForm.reset();
        document.getElementById('user-id').value = '';
        if (userId) {
            try {
                // Para não criar um endpoint `GET /users/:id`, buscamos todos e filtramos.
                // Para um número grande de usuários, o ideal seria ter o endpoint específico.
                const allUsers = await fetchUsers();
                const user = allUsers.find(u => u.id === userId);
                if (user) {
                    userFormTitle.textContent = 'Editar Usuário';
                    document.getElementById('user-id').value = user.id;
                    document.getElementById('user-nome').value = user.nome;
                    document.getElementById('user-email').value = user.email;
                    document.getElementById('user-role').value = user.role;
                }
            } catch (error) {
                showToast('Erro ao carregar dados do usuário.', 'error');
                return;
            }
        } else {
            userFormTitle.textContent = 'Adicionar Novo Usuário';
            document.getElementById('user-id').value = '';
        }
        userFormModal.classList.remove('hidden');
    }
    
    function closeUserFormModal() {
        userFormModal.classList.add('hidden');
    }

    async function handleUserFormSubmit(event) {
        event.preventDefault();
        const id = document.getElementById('user-id').value;
        const userData = {
            nome: document.getElementById('user-nome').value,
            email: document.getElementById('user-email').value,
            role: document.getElementById('user-role').value,
        };

        if (id) userData.id = id;

        try {
            await saveUser(userData);
            closeUserFormModal();
            showToast('Usuário salvo com sucesso!', 'success');
            await renderUsersTable();
        } catch (error) {
            console.error('Erro ao salvar usuário:', error);
            showToast('Não foi possível salvar o usuário. Tente novamente.', 'error');
        }
    }
    
    function showCepByCepTab() {
        cepContentByCep.classList.remove('hidden');
        cepContentByAddress.classList.add('hidden');
        cepTabByCep.classList.add('border-primary', 'text-primary');
        cepTabByCep.classList.remove('border-transparent', 'text-gray-500');
        cepTabByAddress.classList.add('border-transparent', 'text-gray-500');
        cepTabByAddress.classList.remove('border-primary', 'text-primary');
        cepResults.innerHTML = '';
    }

    function showCepByAddressTab() {
        cepContentByAddress.classList.remove('hidden');
        cepContentByCep.classList.add('hidden');
        cepTabByAddress.classList.add('border-primary', 'text-primary');
        cepTabByAddress.classList.remove('border-transparent', 'text-gray-500');
        cepTabByCep.classList.add('border-transparent', 'text-gray-500');
        cepTabByCep.classList.remove('border-primary', 'text-primary');
        cepResults.innerHTML = '';
    }

    function renderCepResults(data, isList = false) {
        cepResults.innerHTML = '';
        if ((isList && data.length === 0) || (!isList && data.erro)) {
            cepResults.innerHTML = `<div class="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-4 rounded-md" role="alert"><p class="font-bold">Aviso</p><p>Nenhum endereço encontrado para os termos informados.</p></div>`;
            return;
        }

        const resultsArray = isList ? data : [data];

        const resultCards = resultsArray.map(item => `
            <div class="bg-surface p-4 rounded-lg shadow-sm border">
                <p><strong>CEP:</strong> ${item.cep}</p>
                <p><strong>Logradouro:</strong> ${item.logradouro}</p>
                <p><strong>Bairro:</strong> ${item.bairro}</p>
                <p><strong>Cidade:</strong> ${item.localidade}</p>
                <p><strong>Estado:</strong> ${item.uf}</p>
            </div>
        `).join('');

        cepResults.innerHTML = `<div class="space-y-4">${resultCards}</div>`;
    }

    async function handleCepSearch(event) {
        event.preventDefault();
        const submitButton = cepFormByCep.querySelector('button[type="submit"]');
        const cep = cepInput.value.replace(/\D/g, '');
        if (cep.length !== 8) {
            showToast('CEP inválido. Por favor, digite 8 números.', 'error');
            return;
        }
        cepResults.innerHTML = `<p class="text-center text-gray-500">Buscando...</p>`;
        toggleButtonLoading(submitButton, true);
        try {
            const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
            if (!response.ok) throw new Error('Falha na busca');
            const data = await response.json();
            renderCepResults(data);
        } catch (error) {
            showToast('Não foi possível realizar a busca. Tente novamente.', 'error');
            cepResults.innerHTML = '';
        } finally {
            toggleButtonLoading(submitButton, false);
        }
    }
    
    async function handleAddressSearch(event) {
        event.preventDefault();
        const state = cepState.value;
        const city = cepCity.value;
        const street = cepStreet.value;
        const submitButton = cepFormByAddress.querySelector('button[type="submit"]');

        if (!state || !city || !street || street.length < 3) {
            showToast('Preencha todos os campos. A rua deve ter no mínimo 3 caracteres.', 'error');
            return;
        }
        cepResults.innerHTML = `<p class="text-center text-gray-500">Buscando...</p>`;
        toggleButtonLoading(submitButton, true);
        try {
            const response = await fetch(`https://viacep.com.br/ws/${state}/${city}/${street}/json/`);
            if (!response.ok) throw new Error('Falha na busca');
            const data = await response.json();
            renderCepResults(data, true);
        } catch (error) {
            showToast('Não foi possível realizar a busca. Tente novamente.', 'error');
            cepResults.innerHTML = '';
        } finally {
            toggleButtonLoading(submitButton, false);
        }
    }

    // =================================================================================
    // EVENT LISTENERS
    // =================================================================================
    let currentStatusBadge = null;

    const hideStatusMenu = () => {
        if (!statusDropdownMenu.classList.contains('hidden')) {
            statusDropdownMenu.classList.add('hidden');
            document.removeEventListener('click', hideStatusMenu, true);
            currentStatusBadge = null;
        }
    }

    sidebarToggleBtn.addEventListener('click', () => {
        sidebar.classList.toggle('w-64');
        sidebar.classList.toggle('w-0');
        document.querySelectorAll('.sidebar-text').forEach(text => text.classList.toggle('hidden'));
    });

    if (loginForm) {
        loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const email = loginForm.email.value;
            const password = passwordInput.value;

            // Credenciais fixas
            const validEmail = 'motiveimoveis@gmail.com';
            const validPassword = 'motive@sistema';

            if (email === validEmail && password === validPassword) {
                loginPage.remove();
                appMenuView.classList.remove('hidden');
            } else {
                showToast('Credenciais inválidas. Tente novamente.', 'error');
            }
        });
    }

    if (togglePasswordBtn) {
        togglePasswordBtn.addEventListener('click', function () {
            // toggle the type attribute
            const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
            passwordInput.setAttribute('type', type);
            // toggle the eye slash icon
            const icon = this.querySelector('i');
            icon.classList.toggle('fa-eye');
            icon.classList.toggle('fa-eye-slash');
        });
    }
    
    // Função auxiliar para colapsar a sidebar.
    const collapseSidebar = () => {
        // Apenas colapsa se já não estiver colapsada, para evitar que a interface "pisque".
        if (!sidebar.classList.contains('w-0')) {
            sidebar.classList.remove('w-64');
            sidebar.classList.add('w-0');
            document.querySelectorAll('.sidebar-text').forEach(text => text.classList.add('hidden'));
        }
    };

    // Função para entrar em uma das aplicações a partir do menu principal.
    // Esta é a única ação que deve colapsar a sidebar por padrão.
    const enterApplication = (viewName, setupFunction = null) => {
        appMenuView.classList.add('hidden');
        appStructure.classList.remove('hidden');
        collapseSidebar();
        
        if (setupFunction) {
            setupFunction();
        }
        navigateTo(viewName);
    };

    appCardDashboard.addEventListener('click', () => enterApplication('dashboard'));
    appCardClients.addEventListener('click', () => enterApplication('clients', populateFilters));
    appCardPdf.addEventListener('click', () => enterApplication('pdf'));
    appCardReceipt.addEventListener('click', () => enterApplication('receipt'));
    appCardCep.addEventListener('click', () => enterApplication('cep'));
    appCardSettings.addEventListener('click', () => enterApplication('settings', renderUsersTable));

    navLinks.appMenu.addEventListener('click', (e) => {
        e.preventDefault();
        appStructure.classList.add('hidden');
        appMenuView.classList.remove('hidden');
    });


    Object.keys(navLinks).forEach(key => {
        if (key === 'appMenu') return; 
        navLinks[key].addEventListener('click', (e) => {
            e.preventDefault();
            // A navegação interna não colapsa a sidebar
            navigateTo(key);
            // Adicionado para garantir que a tabela de usuários seja renderizada ao clicar no link da sidebar
            if (key === 'settings') renderUsersTable();
        });
    });
    
    tabActive.addEventListener('click', () => showActiveTab());
    tabSigned.addEventListener('click', () => showSignedTab());
    tabArchived.addEventListener('click', () => showArchivedTab());
    
    cepTabByCep.addEventListener('click', showCepByCepTab);
    cepTabByAddress.addEventListener('click', showCepByAddressTab);

    searchInput.addEventListener('input', renderClientsTable);
    filterStatus.addEventListener('change', renderClientsTable);
    filterProfessional.addEventListener('change', renderClientsTable);
    
    // Adiciona listeners para os novos filtros da aba de arquivados
    searchArchivedInput.addEventListener('input', renderArchivedTable);

    filterProfessionalArchived.addEventListener('change', renderArchivedTable);
    filterArchiveMonth.addEventListener('change', renderArchivedTable);
    filterArchiveYear.addEventListener('change', renderArchivedTable);

    // Função debounce para evitar chamadas excessivas à API ao digitar
    const debounce = (func, delay) => {
        let timeout;
        return function(...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), delay);
        };
    };

    // Handler debounced para salvar a data
    const debouncedSaveDate = debounce(async (target) => {
        const clientId = parseInt(target.dataset.id, 10);
        const dateString = target.value;

        const dateValue = dateString ? new Date(`${dateString}T12:00:00.000Z`).toISOString() : null;

        try {
            await saveClient({ id: clientId, dataAssinaturaContrato: dateValue });
            showToast('Data de assinatura atualizada.', 'success');
            target.dataset.originalValue = dateString; // Atualiza o valor original
        } catch (error) {
            console.error("Erro ao atualizar data:", error);
            showToast('Falha ao salvar a data.', 'error');
            if (target.dataset.originalValue) {
                target.value = target.dataset.originalValue;
            }
        }
    }, 800); // Atraso de 800ms

    clientsTableBody.addEventListener('input', (e) => {
        if (e.target.classList.contains('signature-date-input')) {
            const signBtn = e.target.closest('tr').querySelector('.sign-btn');
            if (signBtn) signBtn.disabled = !e.target.value;
            debouncedSaveDate(e.target);
        }
    });

    clientsTableBody.addEventListener('click', async e => {
        const badge = e.target.closest('.status-badge');
        if (badge) {
            e.stopPropagation(); 
            if (currentStatusBadge === badge) {
                hideStatusMenu();
                return;
            }
            currentStatusBadge = badge;
            const clientId = parseInt(badge.dataset.id, 10);
            
            statusDropdownMenu.innerHTML = '';
            STATUS_OPTIONS.forEach(opt => {
                const item = document.createElement('div');
                item.className = 'px-3 py-1.5 hover:bg-gray-100 cursor-pointer';
                item.textContent = opt;
                item.dataset.status = opt;
                item.dataset.clientId = clientId;
                statusDropdownMenu.appendChild(item);
            });

            const rect = badge.getBoundingClientRect();
            statusDropdownMenu.style.top = `${rect.bottom + window.scrollY + 4}px`;
            statusDropdownMenu.style.left = `${rect.left + window.scrollX}px`;
            statusDropdownMenu.classList.remove('hidden');

            document.addEventListener('click', hideStatusMenu, true);
        }

        if (e.target.classList.contains('edit-btn')) {
            await openFormModal(parseInt(e.target.dataset.id));
        } else if (e.target.classList.contains('sign-btn')) {
            const clientId = parseInt(e.target.dataset.id, 10);
            try {
                await saveClient({ id: clientId, status: 'Assinado-Movido' });
                showToast('Cliente movido para Assinados.', 'success');
                await renderClientsTable();
            } catch (error) {
                showToast('Falha ao mover o cliente.', 'error');
            }
        } else if (e.target.classList.contains('delete-client-btn')) {
            confirmDeleteClientBtn.dataset.clientId = parseInt(e.target.dataset.id, 10);
            deleteClientConfirmModal.classList.remove('hidden');
        }
    });

    signedTableBody.addEventListener('click', async e => {
        if (e.target.classList.contains('edit-btn')) {
            await openFormModal(parseInt(e.target.dataset.id));
        } else if (e.target.classList.contains('archive-btn')) {
            confirmArchiveBtn.dataset.clientId = parseInt(e.target.dataset.id, 10);
            archiveConfirmModal.classList.remove('hidden');
        }
    });

    // Adiciona listener para a tabela de arquivados
    archivedTableBody.addEventListener('click', async e => {
        if (e.target.classList.contains('edit-btn')) {
            await openFormModal(parseInt(e.target.dataset.id));
        } else if (e.target.classList.contains('delete-client-btn')) {
            confirmDeleteClientBtn.dataset.clientId = parseInt(e.target.dataset.id, 10);
            deleteClientConfirmModal.classList.remove('hidden');
        } else if (e.target.classList.contains('restore-client-btn')) {
            const clientId = parseInt(e.target.dataset.id, 10);
            try {
                const updatedClient = await saveClient({ id: clientId, status: 'Aprovado' }); // Volta para o status inicial
                logActivity(updatedClient.nome, 'Cliente restaurado para processos ativos');
                showToast('Cliente restaurado com sucesso!', 'success');
                await showArchivedTab(); // Atualiza a tabela de arquivados
            } catch (error) {
                showToast('Falha ao restaurar o cliente.', 'error');
            }
        }
    });

    statusDropdownMenu.addEventListener('click', async e => {
        const target = e.target;
        if (target.dataset.status) {
            const newStatus = target.dataset.status;
            const clientId = parseInt(target.dataset.clientId, 10);
            
            try {
                const updatedClient = await saveClient({ id: clientId, status: newStatus });
                logActivity(updatedClient.nome, `Status alterado para ${newStatus}`);
                showToast(`Status de ${updatedClient.nome} alterado para ${newStatus}.`, 'success');
                
                const originalBadge = document.querySelector(`.status-badge[data-id="${clientId}"]`);
                if(originalBadge) updateStatusBadge(originalBadge, newStatus);
            } catch (error) {
                console.error("Erro ao atualizar status:", error);
                showToast('Falha ao alterar o status.', 'error');
            }
            hideStatusMenu();
        }
    });
    
    usersTableBody.addEventListener('click', async e => {
        if (e.target.classList.contains('edit-user-btn')) {
            await openUserFormModal(parseInt(e.target.dataset.id));
        }
        if (e.target.classList.contains('delete-user-btn')) {
            confirmDeleteUserBtn.dataset.userId = parseInt(e.target.dataset.id, 10);
            deleteUserConfirmModal.classList.remove('hidden');
        }
    });

    addClientBtn.addEventListener('click', () => openFormModal(null));
    closeModalBtn.addEventListener('click', closeFormModal);
    cancelFormBtn.addEventListener('click', closeFormModal);
    clientForm.addEventListener('submit', handleFormSubmit);
    
    // Adiciona máscara de formatação para campos no formulário de cliente
    clientForm.addEventListener('input', (e) => {
        if (e.target.id === 'cpf') {
            e.target.value = formatCPF(e.target.value);
        } else if (e.target.id === 'agencia') {
            e.target.value = e.target.value.replace(/\D/g, '');
        }
    });

    addUserBtn.addEventListener('click', () => openUserFormModal(null));
    closeUserModalBtn.addEventListener('click', closeUserFormModal);
    cancelUserFormBtn.addEventListener('click', closeUserFormModal);
    userForm.addEventListener('submit', handleUserFormSubmit);
    
    cepInput.addEventListener('input', (e) => {
        let value = e.target.value.replace(/\D/g, '');
        if (value.length > 5) value = value.replace(/^(\d{5})(\d)/, '$1-$2');
        e.target.value = value;
    });
    cepFormByCep.addEventListener('submit', handleCepSearch);
    cepFormByAddress.addEventListener('submit', handleAddressSearch);

    cancelArchiveBtn.addEventListener('click', () => archiveConfirmModal.classList.add('hidden'));
    confirmArchiveBtn.addEventListener('click', async () => {
        const clientId = parseInt(confirmArchiveBtn.dataset.clientId, 10);
        archiveConfirmModal.classList.add('hidden');

        try {
            const updatedClient = await saveClient({ id: clientId, status: 'Arquivado' });
            logActivity(updatedClient.nome, 'Cliente arquivado');
            showToast('Cliente arquivado com sucesso!', 'success');
            await showSignedTab();
        } catch (error) {
            console.error("Erro ao arquivar cliente:", error);
            showToast('Falha ao arquivar o cliente.', 'error');
        }
    });
    
    cancelDeleteUserBtn.addEventListener('click', () => deleteUserConfirmModal.classList.add('hidden'));
    confirmDeleteUserBtn.addEventListener('click', async () => {
        const userId = parseInt(confirmDeleteUserBtn.dataset.userId, 10);
        deleteUserConfirmModal.classList.add('hidden');
        try {
            await deleteUser(userId);
            showToast('Usuário excluído com sucesso.', 'success');
            await renderUsersTable();
        } catch (error) {
            showToast('Falha ao excluir o usuário.', 'error');
        }
    });

    cancelDeleteClientBtn.addEventListener('click', () => deleteClientConfirmModal.classList.add('hidden'));
    confirmDeleteClientBtn.addEventListener('click', async () => {
        const clientId = parseInt(confirmDeleteClientBtn.dataset.clientId, 10);
        deleteClientConfirmModal.classList.add('hidden');
        try {
            await deleteClient(clientId);
            showToast('Cliente excluído com sucesso.', 'success');
            await renderClientsTable();
        } catch (error) {
            console.error("Erro ao excluir cliente:", error);
            showToast('Falha ao excluir o cliente.', 'error');
        }
    });

    // Event Listeners do Editor de PDF
    pdfFileInputReplace.addEventListener('change', (e) => handlePdfFileSelection(e, false));
    pdfFileInputAppend.addEventListener('change', (e) => handlePdfFileSelection(e, true));
    addMorePdfBtn.addEventListener('click', () => pdfFileInputAppend.click());
    clearPdfBtn.addEventListener('click', clearAllPdfPages);
    savePdfBtn.addEventListener('click', saveMergedPdf);

    // Event Listeners do Gerador de Recibos
    prolaboreBruto.addEventListener('input', atualizarCalculos);
    buscarCnpjBtn.addEventListener('click', buscarDadosCNPJ);
    generatePdfBtn.addEventListener('click', () => {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
        
        const nomeEmpresa = empresaNome.value;
        const cnpjEmpresa = empresaCnpj.value;
        const enderecoEmpresa = empresaEndereco.value;
        const cidadeEmpresa = empresaCidade.value;
        const cepEmpresa = empresaCep.value;
        const nomeSocio = socioNome.value;
        const funcaoSocio = socioFuncao.value;
        const refMes = mesReferencia.value;
        const salarioMinimoValor = SALARIO_MINIMO_2025;
        const brutoProlabore = parseFloat(prolaboreBruto.value);
    
        // Recalcula os valores para garantir que estão corretos no momento da emissão
        const inss = calcularINSS(brutoProlabore);
        const baseCalculoIR = brutoProlabore - inss.valor;
        const ir = calcularIR(baseCalculoIR);
        const totalDescontos = inss.valor + ir.valor;
        const valorLiquido = brutoProlabore - totalDescontos;
        const salariosMinimos = (brutoProlabore / salarioMinimoValor).toFixed(1).replace('.', ',');
        
        // --- INÍCIO DA RENDERIZAÇÃO DO LAYOUT DO PDF (COM MELHORIAS VISUAIS) ---
        const pageW = doc.internal.pageSize.getWidth();
        const margin = 15;
        let y = 20;
    
        // Título do Documento
        doc.setFont('helvetica', 'bold').setFontSize(14);
        doc.text("Recibo de Pagamento de Pró-Labore", pageW / 2, y, { align: 'center' });
        y += 10;

        // Cabeçalho da Empresa (canto superior esquerdo)
        doc.setFont('helvetica', 'bold').setFontSize(10);
        doc.text(nomeEmpresa, margin, y); y += 4;
        doc.setFont('helvetica', 'normal').setFontSize(9);
        doc.text(enderecoEmpresa, margin, y); y += 4;
        doc.text(`${cepEmpresa}   ${cidadeEmpresa}`, margin, y); y += 4;
        doc.text(`CNPJ: ${cnpjEmpresa}`, margin, y);
        
        // Mês de referência (canto superior direito)
        let yDireita = 30; // Posição inicial Y para o bloco da direita
        doc.setFont('helvetica', 'bold').setFontSize(9).text(`Referente ao mês: ${refMes}`, pageW - margin, yDireita, { align: 'right' });
        
        y += 12; // Espaçamento para a próxima seção
    
        // Dados do Sócio
        doc.setFont('helvetica', 'bold').setFontSize(10);
        doc.setFont('helvetica', 'bold').text(`Nome: ${nomeSocio}`, margin, y);
        doc.setFont('helvetica', 'normal').setFontSize(9).text(`Função: ${funcaoSocio}`, margin, y + 5);
        
        y += 12;
        
        // Linha divisória
        doc.setDrawColor(200).setLineWidth(0.2); // Cinza claro
        doc.line(margin, y, pageW - margin, y); y += 5;
    
        // Cabeçalho da Tabela
        doc.setFillColor(240, 240, 240); // Fundo cinza claro para o cabeçalho
        doc.rect(margin, y - 4, pageW - (margin * 2), 7, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(50); // Texto mais escuro
        doc.text("CÓDIGO", margin, y);
        doc.text("DESCRIÇÕES", 35, y);
        doc.text("REFERÊNCIAS", 110, y);
        doc.text("VENCIMENTOS", 145, y);
        doc.text("DESCONTOS", pageW - margin, y, { align: 'right' });
        y += 6;
    
        // Corpo da Tabela
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(0); // Volta para texto preto
        doc.text("35", margin, y);
        doc.text("Honorário pro-labore", 35, y);
        doc.text(formatarMoeda(brutoProlabore), 160, y, { align: 'right' }); y += 5;
    
        doc.text("91006", margin, y);
        doc.text("INSS pro-labore", 35, y);
        doc.text(`${formatarMoeda(inss.aliquotaEfetiva)}%`, 128, y, { align: 'right' });
        doc.text(formatarMoeda(inss.valor), pageW - margin, y, { align: 'right' }); y += 5;
    
        doc.text("91506", margin, y);
        doc.text("IR pro-labore", 35, y);
        doc.text(`${formatarMoeda(ir.aliquota)}%`, 128, y, { align: 'right' });
        doc.text(formatarMoeda(ir.valor), pageW - margin, y, { align: 'right' }); y += 10;
        
        // Seção de Totais
        const boxStartX = 115;
        doc.setDrawColor(200);
        doc.line(boxStartX, y, pageW - margin, y); y += 4;
    
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.text("Total", boxStartX + 2, y);
        doc.text(formatarMoeda(brutoProlabore), 160, y, { align: 'right' });
        doc.text(formatarMoeda(totalDescontos), pageW - margin, y, { align: 'right' }); y += 2;
        doc.line(boxStartX, y, pageW - margin, y); y += 4;
    
        doc.setFont('helvetica', 'bold');
        doc.text("VALOR LÍQUIDO", boxStartX + 2, y);
        doc.text(`R$ ${formatarMoeda(valorLiquido)}`, pageW - margin, y, { align: 'right' }); y += 2;
        doc.line(boxStartX, y, pageW - margin, y); y += 15;
        
        // Texto do Recibo
        doc.setFont('helvetica', 'normal').setFontSize(10);
        const textBody = `Recebi de ${nomeEmpresa} a importância de R$ ${formatarMoeda(valorLiquido)}, referente ao meu PRO LABORE de ${refMes}, com os descontos exigidos em Lei. Declaro, outrossim, que meu salário base para fins de desconto das contribuições ao INSS é equivalente a ${salariosMinimos} salário(s) mínimo(s).\nSalário mínimo vigente: R$ ${formatarMoeda(salarioMinimoValor)}`;
        const splitText = doc.splitTextToSize(textBody, pageW - (margin * 2));
        doc.text(splitText, margin, y); y += splitText.length * 4 + 20;
    
        // Assinatura
        const signatureLineWidth = 70;
        const signatureLineX = (pageW - signatureLineWidth) / 2;
        doc.line(signatureLineX, y, signatureLineX + signatureLineWidth, y); y += 4;
        
        doc.text(nomeSocio, pageW / 2, y, { align: 'center' });
    
        doc.save(`recibo_prolabore_${nomeSocio.split(' ')[0]}_${refMes.replace('/', '-')}.pdf`);
    });
    empresaCnpj.addEventListener('input', (e) => e.target.value = formatCNPJ(e.target.value.replace(/\D/g, '')));

});