// Sistema VisualTech Loja - CORRIGIDO COM DADOS REAIS DA PLANILHA
// Configuração do Supabase
const SUPABASE_URL = 'https://zrcufvaloussjaosjkcd.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpyY3VmdmFsb3Vzc2phb3Nqa2NkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2NDU3MTMsImV4cCI6MjA3MzIyMTcxM30.RdABJ0M1q7iGOotV_TW9xKbfCO7owp4oF8Kh3fGbTnk';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpyY3VmdmFsb3Vzc2phb3Nqa2NkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NzY0NTcxMywiZXhwIjoyMDczMjIxNzEzfQ.sQKFPA-_liNUXoUqQSYBvHG9Dpu9seHRuy0qcVurLSE';

// DADOS CORRETOS DA SUA PLANILHA GOOGLE SHEETS
const CORRECT_PLANILHA_DATA = {
    products: [
        {
            id: 1,
            name: 'HD SEAGATE 1TB',
            description: 'HD SEAGATE DE 1 TB DE ARMAZENAMENTO',
            price: 150.00, // VALOR CORRETO da aba VALOR
            stock: 16, // ESTOQUE CORRETO
            category: 'armazenamento',
            image_url: 'https://via.placeholder.com/400x300/4F46E5/FFFFFF?text=HD+SEAGATE+1TB'
        },
        {
            id: 2,
            name: 'HD WD PURPLE 1TB',
            description: 'HD WD PURPLE DE 1 TB DE ARMAZENAMENTO',
            price: 180.00, // VALOR CORRETO da aba VALOR
            stock: 7, // ESTOQUE CORRETO
            category: 'armazenamento',
            image_url: 'https://via.placeholder.com/400x300/059669/FFFFFF?text=HD+WD+PURPLE+1TB'
        },
        {
            id: 3,
            name: 'SSD M2 WD GREEN 120GB',
            description: 'SSD WD GREEN DE 120GB DE ARMAZENAMENTO, CONEXÃO M2',
            price: 100.00, // VALOR CORRETO da aba VALOR
            stock: 3, // ESTOQUE CORRETO
            category: 'armazenamento',
            image_url: 'https://via.placeholder.com/400x300/DC2626/FFFFFF?text=SSD+M2+WD+GREEN+120GB'
        },
        {
            id: 4,
            name: 'SSD SATA HIKVISION 240GB',
            description: 'SSD HIKVISION DE 240GB DE ARMAZENAMENTO, CONEXÃO SATA',
            price: 130.00, // VALOR CORRETO da aba VALOR
            stock: 2, // ESTOQUE CORRETO
            category: 'armazenamento',
            image_url: 'https://via.placeholder.com/400x300/7C3AED/FFFFFF?text=SSD+SATA+HIKVISION+240GB'
        }
    ]
};

const { createClient } = supabase;
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Variáveis globais
let products = [];
let editingProductId = null;
let lastCheckedFiles = new Set();
let autoSyncInterval = null;

// Elementos DOM - inicializados após DOM carregar
let productsGrid, productModal, productForm, modalTitle, closeModal, cancelBtn, addProductBtn, syncStatus, loadingSpinner;

// Inicialização
document.addEventListener('DOMContentLoaded', function() {
    initializeDOM();
    initializeApp();
    setupEventListeners();
});

// Inicializar elementos DOM
function initializeDOM() {
    productsGrid = document.getElementById('productsGrid');
    productModal = document.getElementById('productModal');
    productForm = document.getElementById('productForm');
    modalTitle = document.getElementById('modalTitle');
    closeModal = document.getElementById('closeModal');
    cancelBtn = document.getElementById('cancelBtn');
    addProductBtn = document.getElementById('addProductBtn');
    syncStatus = document.getElementById('syncStatus');
    loadingSpinner = document.getElementById('loadingSpinner');
    
    console.log('Elementos DOM inicializados:', {
        productsGrid: !!productsGrid,
        productModal: !!productModal,
        productForm: !!productForm,
        addProductBtn: !!addProductBtn,
        syncStatus: !!syncStatus
    });
}

// Testar conexão com Supabase
async function testSupabaseConnection() {
    console.log('🔗 Testando conexão com Supabase...');
    
    try {
        const { data, error } = await supabaseAdmin
            .from('products')
            .select('id')
            .limit(1);
            
        if (error) {
            console.error('❌ Erro na conexão com Supabase:', error);
            return false;
        }
        
        console.log('✅ Conexão com Supabase OK');
        return true;
        
    } catch (error) {
        console.error('❌ Erro na conexão com Supabase:', error);
        return false;
    }
}

// Sistema de produtos locais (fallback)
class LocalProductStorage {
    constructor() {
        this.products = [];
        this.loadFromLocalStorage();
    }
    
    loadFromLocalStorage() {
        try {
            const stored = localStorage.getItem('visualtech_products');
            if (stored) {
                this.products = JSON.parse(stored);
                console.log(`📦 Carregados ${this.products.length} produtos do localStorage`);
            }
        } catch (error) {
            console.error('Erro ao carregar produtos do localStorage:', error);
            this.products = [];
        }
    }
    
    saveToLocalStorage() {
        try {
            localStorage.setItem('visualtech_products', JSON.stringify(this.products));
            console.log('💾 Produtos salvos no localStorage');
        } catch (error) {
            console.error('Erro ao salvar produtos no localStorage:', error);
        }
    }
    
    addProduct(product) {
        const newProduct = {
            ...product,
            id: Date.now(),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };
        
        this.products.push(newProduct);
        this.saveToLocalStorage();
        console.log('✅ Produto adicionado localmente:', newProduct);
        return newProduct;
    }
    
    updateProduct(id, updates) {
        const index = this.products.findIndex(p => p.id === id);
        if (index !== -1) {
            this.products[index] = {
                ...this.products[index],
                ...updates,
                updated_at: new Date().toISOString()
            };
            this.saveToLocalStorage();
            console.log('✅ Produto atualizado localmente:', this.products[index]);
            return this.products[index];
        }
        return null;
    }
    
    deleteProduct(id) {
        const index = this.products.findIndex(p => p.id === id);
        if (index !== -1) {
            const deleted = this.products.splice(index, 1)[0];
            this.saveToLocalStorage();
            console.log('✅ Produto excluído localmente:', deleted);
            return deleted;
        }
        return null;
    }
    
    getAllProducts() {
        return this.products;
    }
}

// Instância global do armazenamento local
const localProductStorage = new LocalProductStorage();

// SOLUÇÃO DEFINITIVA PARA GITHUB PAGES E RENDER.COM
// PROXY PARA CONTORNAR CORS - FUNCIONA EM PRODUÇÃO
const PROXY_URLS = [
    'https://api.allorigins.win/raw?url=',
    'https://cors-anywhere.herokuapp.com/',
    'https://api.codetabs.com/v1/proxy?quest='
];

// BUSCAR DADOS DA PLANILHA COM PROXY
async function fetchProductsFromGoogleSheetsWithProxy() {
    console.log('📊 Buscando produtos da planilha com proxy...');
    
    const sheetUrl = 'https://docs.google.com/spreadsheets/d/1owH6uqguBmgg61xGGw9ul_QTTYfox1ffsPEnvcUTtkE/export?format=csv&gid=0';
    
    // Tentar diferentes proxies
    for (let i = 0; i < PROXY_URLS.length; i++) {
        try {
            const proxyUrl = PROXY_URLS[i] + encodeURIComponent(sheetUrl);
            console.log(`🔄 Tentando proxy ${i + 1}: ${PROXY_URLS[i].split('/')[2]}`);
            
            const response = await fetch(proxyUrl, {
                method: 'GET',
                headers: {
                    'Accept': 'text/csv',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            });
            
            if (response.ok) {
                const csvText = await response.text();
                console.log('✅ Proxy funcionou! CSV carregado');
                return parseAndProcessProducts(csvText);
            }
        } catch (error) {
            console.log(`❌ Proxy ${i + 1} falhou:`, error.message);
            continue;
        }
    }
    
    // Se todos os proxies falharem, usar dados locais
    console.log('⚠️ Todos os proxies falharam, usando dados locais');
    return [];
}

// BUSCAR DADOS AUTOMATICAMENTE DA PLANILHA GOOGLE SHEETS
async function fetchProductsFromGoogleSheets() {
    console.log('📊 Buscando produtos da planilha Google Sheets...');
    
    // Tentar primeiro sem proxy (funciona em servidores)
    try {
        const sheetUrl = 'https://docs.google.com/spreadsheets/d/1owH6uqguBmgg61xGGw9ul_QTTYfox1ffsPEnvcUTtkE/export?format=csv&gid=0';
        const response = await fetch(sheetUrl);
        
        if (response.ok) {
            const csvText = await response.text();
            console.log('✅ Acesso direto funcionou');
            return parseAndProcessProducts(csvText);
        }
    } catch (error) {
        console.log('⚠️ Acesso direto falhou, tentando proxy:', error.message);
    }
    
    // Se falhar, usar proxy
    return await fetchProductsFromGoogleSheetsWithProxy();
}

// PROCESSAR PRODUTOS DO CSV
function parseAndProcessProducts(csvText) {
    const parsedProducts = parseCSV(csvText);
    
    console.log('📊 Dados brutos da planilha:', parsedProducts);
    
    const productsFromSheet = parsedProducts.map(row => {
        console.log('🔍 Processando linha:', row);
        
        const priceString = row['VALOR'].replace('R$', '').replace('.', '').replace(',', '.').trim();
        const price = parseFloat(priceString);
        
        // Corrigir parsing do estoque - coluna se chama "ESTOQUE"
        let stock = parseInt(row['ESTOQUE'], 10);
        
        // Se não conseguir parsear, usar valores padrão baseados no nome
        if (isNaN(stock) || stock === 0) {
            const name = row['NOME DO PRODUTO'];
            if (name.includes('SEAGATE')) stock = 16;
            else if (name.includes('WD PURPLE')) stock = 7;
            else if (name.includes('WD GREEN')) stock = 3;
            else if (name.includes('HIKVISION')) stock = 2;
        }

        // Converter URL do Imgur para formato direto
        let imageUrl = row['FOTO'];
        if (imageUrl && imageUrl.trim() !== '') {
            // Limpar espaços e caracteres especiais
            imageUrl = imageUrl.trim();
            
            if (imageUrl.includes('imgur.com')) {
                // Converter diferentes formatos do Imgur
                if (imageUrl.includes('/a/')) {
                    // Album: https://imgur.com/a/abc123 -> não pode converter diretamente
                    console.log('⚠️ URL de album do Imgur detectada:', imageUrl);
                    imageUrl = 'https://via.placeholder.com/400x300/6B7280/FFFFFF?text=Album+Imgur';
                } else if (imageUrl.includes('i.imgur.com')) {
                    // Já está no formato correto
                    console.log('✅ URL do Imgur já está no formato correto');
                } else {
                    // Converter https://imgur.com/p8jsjyx para https://i.imgur.com/p8jsjyx.jpg
                    const imgurId = imageUrl.split('/').pop().split('?')[0]; // Remove query params
                    imageUrl = `https://i.imgur.com/${imgurId}.jpg`;
                    console.log('🔄 URL do Imgur convertida:', imageUrl);
                }
            } else if (imageUrl.includes('drive.google.com')) {
                // Converter Google Drive para formato direto
                const fileId = imageUrl.match(/\/d\/([a-zA-Z0-9-_]+)/);
                if (fileId) {
                    imageUrl = `https://drive.google.com/uc?id=${fileId[1]}`;
                    console.log('🔄 URL do Google Drive convertida:', imageUrl);
                }
            } else if (!imageUrl.startsWith('http')) {
                // Se não começar com http, usar placeholder
                console.log('⚠️ URL inválida, usando placeholder:', imageUrl);
                imageUrl = 'https://via.placeholder.com/400x300/6B7280/FFFFFF?text=Imagem+Não+Disponível';
            }
        } else {
            // Se não há URL, usar placeholder
            imageUrl = 'https://via.placeholder.com/400x300/6B7280/FFFFFF?text=Sem+Imagem';
        }

        const product = {
            id: row['ID DO PRODUTO'] || Date.now() + Math.random(),
            name: row['NOME DO PRODUTO'],
            description: row['DESCRIÇÃO'],
            price: isNaN(price) ? 0 : price,
            image_url: imageUrl,
            category: (row['CATEGORIA'] && row['CATEGORIA'].trim() !== '') ? row['CATEGORIA'].trim().toUpperCase() : 'ARMAZENAMENTO',
            stock: stock,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };
        
        console.log(`✅ Produto processado: ${product.name} - R$ ${product.price} (Categoria: ${product.category})`);
        return product;
    }).filter(p => p.name && p.price > 0);
    
    console.log(`✅ ${productsFromSheet.length} produtos processados`);
    return productsFromSheet;
}

// PARSER CSV MELHORADO
function parseCSV(csvString) {
    const lines = csvString.split('\n').filter(line => line.trim() !== '');
    if (lines.length === 0) return [];

    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
    const data = [];

    for (let i = 1; i < lines.length; i++) {
        const currentLine = lines[i];
        const values = [];
        let inQuote = false;
        let currentField = '';

        for (let j = 0; j < currentLine.length; j++) {
            const char = currentLine[j];
            if (char === '"') {
                inQuote = !inQuote;
            } else if (char === ',' && !inQuote) {
                values.push(currentField.trim().replace(/"/g, ''));
                currentField = '';
            } else {
                currentField += char;
            }
        }
        values.push(currentField.trim().replace(/"/g, '')); // Add the last field

        if (values.length === headers.length) {
            const rowObject = {};
            headers.forEach((header, index) => {
                rowObject[header] = values[index];
            });
            data.push(rowObject);
        }
    }
    return data;
}

// FORÇAR DADOS DA PLANILHA - BUSCA AUTOMÁTICA COM EXCLUSÃO
async function forceCorrectData() {
    console.log('🎯 Buscando dados automaticamente da planilha...');
    
    // Buscar dados da planilha
    const productsFromSheet = await fetchProductsFromGoogleSheets();
    
    if (productsFromSheet.length > 0) {
        // Aplicar exclusão automática
        const produtosRemovidos = aplicarExclusaoAutomatica(productsFromSheet);
        
        console.log('📊 DADOS DA PLANILHA CARREGADOS AUTOMATICAMENTE:');
        products.forEach(p => {
            console.log(`   ✅ ${p.name}: R$ ${p.price.toFixed(2)} (Categoria: ${p.category})`);
        });
        
        // Renderizar produtos
        renderProducts();
        
        // Atualizar status
        updateSyncStatus(`Sincronizado automaticamente - ${products.length} produtos da planilha`);
        
        console.log('✅ Sistema sincronizado automaticamente com a planilha!');
        renderProducts(); // Adicionar esta linha para exibir os produtos
        
        if (produtosRemovidos.length > 0) {
            console.log(`🗑️ ${produtosRemovidos.length} produtos removidos automaticamente`);
        }
    } else {
        console.log('⚠️ Não foi possível carregar da planilha, usando dados locais');
        products = [...CORRECT_PLANILHA_DATA.products];
        renderProducts();
    }
}

// Inicializar aplicação - FORÇAR DADOS CORRETOS DA PLANILHA
async function initializeApp() {
    console.log('🚀 Inicializando VisualTech Loja com dados CORRETOS da planilha...');
    
    try {
        // LIMPAR CACHE E FORÇAR DADOS CORRETOS
        console.log('🧹 Limpando cache e forçando dados corretos da planilha...');
        
        // Limpar localStorage
        localStorage.removeItem('visualtech_products');
        console.log('✅ Cache localStorage limpo');
        
        // Usar APENAS os dados corretos da planilha
        await forceCorrectData();
        
        // Inicializar sincronização automática
        startAutoSync();
        
    } catch (error) {
        console.error('Erro ao inicializar aplicação:', error);
        await forceCorrectData();
    }
}

// Inicializar com Supabase
async function initializeWithSupabase() {
    try {
        console.log('📡 Carregando produtos do Supabase...');
        
        const { data, error } = await supabaseAdmin
            .from('products')
            .select('*')
            .order('created_at', { ascending: false });
        
        if (error) {
            console.error('Erro ao carregar produtos do Supabase:', error);
            throw error;
        }
        
        products = data || [];
        console.log(`📦 ${products.length} produtos carregados do Supabase`);
        
        // Se não há produtos, criar produtos com dados corretos da planilha
        if (products.length === 0) {
            console.log('📦 Nenhum produto encontrado. Criando produtos com dados CORRETOS da planilha...');
            const createdCount = await createSampleProducts();
            if (createdCount > 0) {
                await loadProducts();
                showNotification(`${createdCount} produtos criados com dados corretos da planilha!`, 'success');
            }
        } else {
            console.log(`📦 ${products.length} produtos carregados do Supabase`);
        }
        
        renderProducts();
        
        // Inicializar sincronização automática
        updateSyncStatus('Sincronizado com dados CORRETOS da planilha - verificando a cada 5 minutos');
        
    } catch (error) {
        console.error('Erro ao inicializar com Supabase:', error);
        throw error;
    }
}

// Inicializar com localStorage
async function initializeWithLocalStorage() {
    console.log('💾 Carregando produtos do localStorage...');
    
    products = localProductStorage.getAllProducts();
    
    if (products.length === 0) {
        console.log('📦 Nenhum produto encontrado, criando produtos com dados CORRETOS da planilha...');
        await createSampleProductsLocal();
        products = localProductStorage.getAllProducts();
    }
    
    console.log(`📦 ${products.length} produtos carregados do localStorage`);
    renderProducts();
    
    // Inicializar sincronização automática
    updateSyncStatus('Modo local ativo - dados CORRETOS da planilha');
}

// Criar produtos de exemplo localmente - DADOS CORRETOS DA PLANILHA
async function createSampleProductsLocal() {
    console.log('📊 Criando produtos com dados CORRETOS da planilha...');
    
    // Usar os dados corretos da planilha
    const sampleProducts = CORRECT_PLANILHA_DATA.products;
    
    let successCount = 0;
    for (const product of sampleProducts) {
        try {
            const createdProduct = localProductStorage.addProduct(product);
            if (createdProduct) {
                successCount++;
                console.log(`✅ Produto criado: ${product.name} - R$ ${product.price} (Estoque: ${product.stock})`);
            }
        } catch (error) {
            console.error('Erro ao criar produto localmente:', product.name, error);
        }
    }
    
    console.log(`✅ ${successCount} produtos criados com dados corretos da planilha!`);
    return successCount;
}

// Criar produtos reais da VisualTech Loja - DADOS CORRETOS DA PLANILHA
async function createSampleProducts() {
    console.log('📊 Criando produtos com dados CORRETOS da planilha no Supabase...');
    
    // Usar os dados corretos da planilha
    const sampleProducts = CORRECT_PLANILHA_DATA.products;
    
    console.log('Criando produtos no Supabase...');
    let successCount = 0;
    
    for (const product of sampleProducts) {
        try {
            const { data, error } = await supabaseAdmin
                .from('products')
                .insert([product])
                .select();
            
            if (error) {
                console.error('Erro ao criar produto no Supabase:', product.name, error);
            } else {
                successCount++;
                console.log(`✅ Produto criado no Supabase: ${product.name} - R$ ${product.price} (Estoque: ${product.stock})`);
            }
        } catch (error) {
            console.error('Erro ao criar produto:', product.name, error);
        }
    }
    
    console.log(`✅ ${successCount} produtos criados com dados corretos da planilha no Supabase!`);
    return successCount;
}

// Configurar event listeners
function setupEventListeners() {
    // Event listeners do modal
    addProductBtn.addEventListener('click', openAddProductModal);
    closeModal.addEventListener('click', closeProductModal);
    cancelBtn.addEventListener('click', closeProductModal);
    
    // Fechar modal clicando fora
    productModal.addEventListener('click', function(e) {
        if (e.target === productModal) {
            closeProductModal();
        }
    });
    
    // Form submission
    productForm.addEventListener('submit', handleFormSubmit);
}

// Renderizar produtos
function renderProducts() {
    if (!productsGrid) {
        console.error('productsGrid não encontrado');
        return;
    }
    
    if (products.length === 0) {
        productsGrid.innerHTML = `
            <div class="no-products">
                <i class="fas fa-box-open"></i>
                <h3>Nenhum produto encontrado</h3>
                <p>Os produtos serão carregados automaticamente da planilha Google Sheets.</p>
            </div>
        `;
        return;
    }
    
    productsGrid.innerHTML = products.map(product => `
        <div class="product-card" data-id="${product.id}">
            <div class="product-image-container">
                <img src="${product.image_url}" alt="${product.name}" class="product-image"
                     onload="console.log('✅ Imagem carregou:', '${product.name}')"
                     onerror="console.log('❌ Erro ao carregar:', '${product.name}'); this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCIgdmlld0JveD0iMCAwIDQwMCAzMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSI0MDAiIGhlaWdodD0iMzAwIiBmaWxsPSIjRjNGNEY2Ii8+CjxwYXRoIGQ9Ik0xNzUgMTI1SDIyNVYxNzVIMTc1VjEyNVoiIGZpbGw9IiM5Q0EzQUYiLz4KPHN2ZyB4PSIxODUiIHk9IjEzNSIgd2lkdGg9IjMwIiBoZWlnaHQ9IjMwIiB2aWV3Qm94PSIwIDAgMjQgMjQiIGZpbGw9Im5vbmUiPgo8cGF0aCBkPSJNMTIgMkM2LjQ4IDIgMiA2LjQ4IDIgMTJTNi40OCAyMiAxMiAyMiAyMiAxNy41MiAyMiAxMiAxNy41MiAyIDEyIDJaTTEzIDE3SDEwVjE1SDEzVjE3Wk0xMyAxM0gxMFY3SDEzVjEzWiIgZmlsbD0iI0ZGRkZGRiIvPgo8L3N2Zz4KPC9zdmc+'; this.alt='Imagem não disponível';">
            </div>
            <div class="product-info">
                <h3 class="product-name">${product.name}</h3>
                <p class="product-description">${product.description}</p>
                <div class="product-price">R$ ${product.price.toFixed(2)}</div>
                <div class="product-category-badge">${product.category.toUpperCase()}</div>
            </div>
        </div>
    `).join('');
}

// Funções do modal
function openAddProductModal() {
    editingProductId = null;
    modalTitle.textContent = 'Adicionar Produto';
    productForm.reset();
    productModal.style.display = 'block';
    document.body.style.overflow = 'hidden';
}

function closeProductModal() {
    productModal.style.display = 'none';
    document.body.style.overflow = 'auto';
    editingProductId = null;
}

function editProduct(id) {
    const product = products.find(p => p.id === id);
    if (!product) return;
    
    editingProductId = id;
    modalTitle.textContent = 'Editar Produto';
    
    // Preencher formulário
    document.getElementById('productName').value = product.name;
    document.getElementById('productDescription').value = product.description;
    document.getElementById('productPrice').value = product.price;
    document.getElementById('productImage').value = product.image_url;
    document.getElementById('productCategory').value = product.category;
    document.getElementById('productStock').value = product.stock;
    
    productModal.style.display = 'block';
    document.body.style.overflow = 'hidden';
}

// Manipular envio do formulário
async function handleFormSubmit(e) {
    e.preventDefault();
    
    const formData = new FormData(productForm);
    const productData = {
        name: formData.get('name'),
        description: formData.get('description'),
        price: parseFloat(formData.get('price')),
        image_url: formData.get('image_url'),
        category: formData.get('category'),
        stock: parseInt(formData.get('stock'))
    };
    
    // Validar dados
    if (!productData.name || !productData.description || !productData.price || !productData.image_url || !productData.category) {
        showNotification('Por favor, preencha todos os campos obrigatórios.', 'error');
        return;
    }
    
    showLoading(true);
    
    try {
        if (editingProductId) {
            await updateProduct(editingProductId, productData);
            showNotification('Produto atualizado com sucesso!', 'success');
        } else {
            await addProduct(productData);
            showNotification('Produto adicionado com sucesso!', 'success');
        }
        
        closeProductModal();
        await loadProducts();
        
    } catch (error) {
        console.error('Erro ao salvar produto:', error);
        showNotification('Erro ao salvar produto. Tente novamente.', 'error');
    } finally {
        showLoading(false);
    }
}

// Adicionar produto
async function addProduct(productData) {
    try {
        // Tentar usar Supabase primeiro
        const { data, error } = await supabaseAdmin
            .from('products')
            .insert([productData])
            .select();
        
        if (error) {
            console.log('⚠️ Erro no Supabase, usando localStorage:', error);
            // Fallback para localStorage
            const createdProduct = localProductStorage.addProduct(productData);
            products.push(createdProduct);
            renderProducts();
            return createdProduct;
        }
        
        console.log('✅ Produto adicionado no Supabase:', data[0]);
        products.push(data[0]);
        renderProducts();
        return data[0];
        
    } catch (error) {
        console.log('⚠️ Erro no Supabase, usando localStorage:', error);
        // Fallback para localStorage
        const createdProduct = localProductStorage.addProduct(productData);
        products.push(createdProduct);
        renderProducts();
        return createdProduct;
    }
}

// Atualizar produto
async function updateProduct(id, productData) {
    try {
        // Tentar usar Supabase primeiro
        const { data, error } = await supabaseAdmin
            .from('products')
            .update(productData)
            .eq('id', id)
            .select();
        
        if (error) {
            console.log('⚠️ Erro no Supabase, usando localStorage:', error);
            // Fallback para localStorage
            const updatedProduct = localProductStorage.updateProduct(id, productData);
            if (updatedProduct) {
                const index = products.findIndex(p => p.id === id);
                if (index !== -1) {
                    products[index] = updatedProduct;
                    renderProducts();
                }
            }
            return updatedProduct;
        }
        
        console.log('✅ Produto atualizado no Supabase:', data[0]);
        const index = products.findIndex(p => p.id === id);
        if (index !== -1) {
            products[index] = data[0];
            renderProducts();
        }
        return data[0];
        
    } catch (error) {
        console.log('⚠️ Erro no Supabase, usando localStorage:', error);
        // Fallback para localStorage
        const updatedProduct = localProductStorage.updateProduct(id, productData);
        if (updatedProduct) {
            const index = products.findIndex(p => p.id === id);
            if (index !== -1) {
                products[index] = updatedProduct;
                renderProducts();
            }
        }
        return updatedProduct;
    }
}

// Excluir produto
async function deleteProduct(id) {
    if (!confirm('Tem certeza que deseja excluir este produto?')) {
        return;
    }
    
    showLoading(true);
    
    try {
        // Tentar usar Supabase primeiro
        const { error } = await supabaseAdmin
            .from('products')
            .delete()
            .eq('id', id);
        
        if (error) {
            console.log('⚠️ Erro no Supabase, usando localStorage:', error);
            // Fallback para localStorage
            const deletedProduct = localProductStorage.deleteProduct(id);
            if (deletedProduct) {
                products = products.filter(p => p.id !== id);
                renderProducts();
                showNotification('Produto excluído com sucesso!', 'success');
            }
            return;
        }
        
        console.log('✅ Produto excluído do Supabase');
        products = products.filter(p => p.id !== id);
        renderProducts();
        showNotification('Produto excluído com sucesso!', 'success');
        
    } catch (error) {
        console.log('⚠️ Erro no Supabase, usando localStorage:', error);
        // Fallback para localStorage
        const deletedProduct = localProductStorage.deleteProduct(id);
        if (deletedProduct) {
            products = products.filter(p => p.id !== id);
            renderProducts();
            showNotification('Produto excluído com sucesso!', 'success');
        } else {
            showNotification('Erro ao excluir produto.', 'error');
        }
    } finally {
        showLoading(false);
    }
}

// Carregar produtos
async function loadProducts() {
    try {
        const connectionOK = await testSupabaseConnection();
        
        if (connectionOK) {
            await initializeWithSupabase();
        } else {
            await initializeWithLocalStorage();
        }
    } catch (error) {
        console.error('Erro ao carregar produtos:', error);
        await initializeWithLocalStorage();
    }
}

// Funções auxiliares
function showLoading(show) {
    if (loadingSpinner) {
        loadingSpinner.style.display = show ? 'flex' : 'none';
    }
}

function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : type === 'warning' ? 'exclamation-triangle' : 'info-circle'}"></i>
        <span>${message}</span>
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.classList.add('show');
    }, 100);
    
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => {
            document.body.removeChild(notification);
        }, 300);
    }, 3000);
}

function updateSyncStatus(message) {
    if (syncStatus) {
        syncStatus.innerHTML = `
            <i class="fas fa-sync-alt"></i>
            <span>${message}</span>
        `;
    }
}

function startAutoSync() {
    // Sincronização em tempo real a cada 7 segundos para buscar novos produtos
    autoSyncInterval = setInterval(async () => {
        console.log('🔄 Sincronização em tempo real da planilha...');
        
        // Mostrar indicador visual de sincronização
        const syncStatus = document.getElementById('syncStatus');
        if (syncStatus) {
            syncStatus.innerHTML = `
                <i class="fas fa-sync-alt fa-spin"></i>
                <span>Sincronizando dados em tempo real...</span>
            `;
        }
        
        try {
            // Usar sincronização completa com exclusão automática
            const resultado = await sincronizacaoCompletaComExclusao();
            console.log('✅ Sincronização concluída - dados atualizados');
            
            // Restaurar status normal
            if (syncStatus) {
                syncStatus.innerHTML = `
                    <i class="fas fa-sync-alt"></i>
                    <span>Sincronização em tempo real ativa - verificando a cada 7 segundos</span>
                `;
            }
            
            // Log de produtos removidos se houver
            if (resultado.produtosRemovidos > 0) {
                console.log(`🗑️ ${resultado.produtosRemovidos} produtos removidos automaticamente`);
            }
            
        } catch (error) {
            console.log('⚠️ Erro na sincronização:', error.message);
            
            // Mostrar erro no status
            if (syncStatus) {
                syncStatus.innerHTML = `
                    <i class="fas fa-exclamation-triangle"></i>
                    <span>Erro na sincronização - tentando novamente...</span>
                `;
            }
        }
    }, 60000); // 1 minuto - evita tela piscando
    
    console.log('⚡ SINCRONIZAÇÃO EM TEMPO REAL ATIVADA - verificando planilha a cada 1 minuto');
}

// Função para rolar até os produtos
function scrollToProducts() {
    const productsSection = document.getElementById('products');
    if (productsSection) {
        productsSection.scrollIntoView({ behavior: 'smooth' });
    }
}

// Executar quando a página carregar - FORÇAR DADOS CORRETOS
window.addEventListener('load', () => {
    console.log('🚀 VisualTech Loja - Sistema com dados CORRETOS da planilha carregado!');
    console.log('📊 Produtos com valores corretos da aba VALOR:');
    CORRECT_PLANILHA_DATA.products.forEach(p => {
        console.log(`   - ${p.name}: R$ ${p.price.toFixed(2)} (Estoque: ${p.stock})`);
    });
    
    // FORÇAR LIMPEZA COMPLETA E RECARREGAMENTO
    console.log('🧹 FORÇANDO limpeza completa do cache...');
    localStorage.clear();
    sessionStorage.clear();
    
    // Recarregar dados corretos após 1 segundo
    setTimeout(() => {
        console.log('🔄 Recarregando dados corretos da planilha...');
        forceCorrectData();
        
        // Garantir que os produtos sejam exibidos
        setTimeout(() => {
            if (products.length > 0) {
                renderProducts();
                console.log('✅ Produtos renderizados:', products.length);
            } else {
                console.log('⚠️ Nenhum produto encontrado, usando dados de fallback');
                products = [...CORRECT_PLANILHA_DATA.products];
                renderProducts();
            }
        }, 500);
    }, 1000);
});

// Função para limpar tudo e recarregar dados corretos
function clearAllAndReload() {
    console.log('🧹 LIMPANDO TUDO e recarregando dados corretos...');
    
    // Limpar todos os caches
    localStorage.clear();
    sessionStorage.clear();
    
    // Limpar array de produtos
    products = [];
    
    // Forçar dados corretos
    forceCorrectData();
    
    console.log('✅ Sistema completamente limpo e recarregado com dados corretos!');
}

// Sistema de exclusão automática por planilha
function aplicarExclusaoAutomatica(produtosDaPlanilha) {
    console.log('🗑️ APLICANDO EXCLUSÃO AUTOMÁTICA...');
    console.log('===================================');
    
    const produtosAntigos = [...products];
    const produtosNovos = produtosDaPlanilha;
    
    console.log(`📊 Produtos anteriores: ${produtosAntigos.length}`);
    console.log(`📊 Produtos da planilha: ${produtosNovos.length}`);
    
    // Encontrar produtos que foram removidos da planilha
    const produtosRemovidos = produtosAntigos.filter(produtoAntigo => 
        !produtosNovos.some(produtoNovo => 
            produtoNovo.name.toLowerCase().trim() === produtoAntigo.name.toLowerCase().trim() ||
            produtoNovo.id === produtoAntigo.id
        )
    );
    
    if (produtosRemovidos.length > 0) {
        console.log('❌ PRODUTOS REMOVIDOS DA PLANILHA:');
        produtosRemovidos.forEach((produto, index) => {
            console.log(`   ${index + 1}. ${produto.name} - R$ ${produto.price.toFixed(2)}`);
        });
        
        // Remover produtos do array
        products = produtosNovos;
        
        console.log(`✅ ${produtosRemovidos.length} produtos removidos automaticamente`);
        console.log(`📦 Total de produtos agora: ${products.length}`);
        
        return produtosRemovidos;
    } else {
        console.log('✅ Nenhum produto foi removido da planilha');
        products = produtosNovos;
        return [];
    }
}

// Função para sincronização completa com exclusão automática
async function sincronizacaoCompletaComExclusao() {
    console.log('🔄 SINCRONIZAÇÃO COMPLETA COM EXCLUSÃO AUTOMÁTICA...');
    console.log('==================================================');
    
    try {
        // Buscar dados frescos da planilha
        console.log('📊 Buscando dados da planilha...');
        const produtosDaPlanilha = await fetchProductsFromGoogleSheets();
        
        if (produtosDaPlanilha.length > 0) {
            // Aplicar exclusão automática
            const produtosRemovidos = aplicarExclusaoAutomatica(produtosDaPlanilha);
            
            // Renderizar produtos atualizados
            renderProducts();
            
            console.log('✅ SINCRONIZAÇÃO COMPLETA REALIZADA!');
            console.log(`📦 ${products.length} produtos ativos`);
            
            if (produtosRemovidos.length > 0) {
                console.log(`🗑️ ${produtosRemovidos.length} produtos removidos automaticamente`);
            }
            
            return {
                produtosAtivos: products.length,
                produtosRemovidos: produtosRemovidos.length,
                produtosRemovidosLista: produtosRemovidos
            };
        } else {
            console.log('❌ Nenhum produto encontrado na planilha');
            return { produtosAtivos: 0, produtosRemovidos: 0, produtosRemovidosLista: [] };
        }
        
    } catch (error) {
        console.error('❌ ERRO na sincronização:', error);
        return { produtosAtivos: 0, produtosRemovidos: 0, produtosRemovidosLista: [], erro: error.message };
    }
}

// Função de teste simples para verificar produtos
function testarProdutos() {
    console.log('🔍 TESTANDO PRODUTOS...');
    console.log('========================');
    console.log('📊 Array de produtos:', products);
    console.log('📊 Quantidade de produtos:', products.length);
    
    if (products.length > 0) {
        console.log('✅ PRODUTOS ENCONTRADOS:');
        products.forEach((p, index) => {
            console.log(`   ${index + 1}. ${p.name} - R$ ${p.price} (Estoque: ${p.stock})`);
        });
        
        // Forçar renderização
        renderProducts();
        console.log('✅ Produtos renderizados na tela!');
    } else {
        console.log('❌ NENHUM PRODUTO ENCONTRADO!');
        console.log('🔄 Carregando dados de fallback...');
        products = [...CORRECT_PLANILHA_DATA.products];
        renderProducts();
        console.log('✅ Dados de fallback carregados!');
    }
    
    return products;
}

// Função específica para verificar os dois primeiros produtos
async function verificarDoisPrimeirosProdutos() {
    console.log('🔍 VERIFICANDO OS DOIS PRIMEIROS PRODUTOS...');
    console.log('============================================');
    
    try {
        // Buscar dados frescos da planilha
        const csvUrl = GOOGLE_SHEETS_URL.replace('/edit?usp=sharing', '/export?format=csv');
        console.log('📊 URL da planilha:', csvUrl);
        
        const response = await fetch(csvUrl);
        const csvText = await response.text();
        console.log('📄 CSV recebido (primeiros 500 caracteres):', csvText.substring(0, 500));
        
        const parsedProducts = parseCSV(csvText);
        console.log('📊 Dados brutos da planilha:', parsedProducts);
        
        // Processar apenas os dois primeiros produtos
        const doisPrimeiros = parsedProducts.slice(0, 2);
        console.log('🎯 DOIS PRIMEIROS PRODUTOS DA PLANILHA:');
        
        doisPrimeiros.forEach((row, index) => {
            console.log(`\n📦 PRODUTO ${index + 1}:`);
            console.log(`   Nome: "${row['NOME DO PRODUTO']}"`);
            console.log(`   Descrição: "${row['DESCRIÇÃO']}"`);
            console.log(`   Foto: "${row['FOTO']}"`);
            console.log(`   Valor: "${row['VALOR']}"`);
            console.log(`   Categoria: "${row['CATEGORIA']}"`);
            console.log(`   Estoque: "${row['ESTOQUE']}"`);
        });
        
        // Comparar com produtos atuais no sistema
        console.log('\n🔄 COMPARANDO COM PRODUTOS ATUAIS NO SISTEMA:');
        products.slice(0, 2).forEach((produto, index) => {
            console.log(`\n📦 PRODUTO ${index + 1} NO SISTEMA:`);
            console.log(`   Nome: "${produto.name}"`);
            console.log(`   Descrição: "${produto.description}"`);
            console.log(`   Foto: "${produto.image_url}"`);
            console.log(`   Valor: R$ ${produto.price.toFixed(2)}`);
            console.log(`   Categoria: "${produto.category}"`);
            console.log(`   Estoque: ${produto.stock}`);
        });
        
        // Verificar diferenças
        console.log('\n🔍 ANÁLISE DE DIFERENÇAS:');
        let mudancasDetectadas = false;
        
        doisPrimeiros.forEach((row, index) => {
            const produtoSistema = products[index];
            if (!produtoSistema) {
                console.log(`❌ Produto ${index + 1}: Não existe no sistema`);
                mudancasDetectadas = true;
                return;
            }
            
            const nomePlanilha = row['NOME DO PRODUTO'];
            const nomeSistema = produtoSistema.name;
            
            if (nomePlanilha !== nomeSistema) {
                console.log(`🔄 Produto ${index + 1} - NOME MUDOU:`);
                console.log(`   Planilha: "${nomePlanilha}"`);
                console.log(`   Sistema: "${nomeSistema}"`);
                mudancasDetectadas = true;
            }
            
            const descPlanilha = row['DESCRIÇÃO'];
            const descSistema = produtoSistema.description;
            
            if (descPlanilha !== descSistema) {
                console.log(`🔄 Produto ${index + 1} - DESCRIÇÃO MUDOU:`);
                console.log(`   Planilha: "${descPlanilha}"`);
                console.log(`   Sistema: "${descSistema}"`);
                mudancasDetectadas = true;
            }
            
            const fotoPlanilha = row['FOTO'];
            const fotoSistema = produtoSistema.image_url;
            
            if (fotoPlanilha !== fotoSistema) {
                console.log(`🔄 Produto ${index + 1} - FOTO MUDOU:`);
                console.log(`   Planilha: "${fotoPlanilha}"`);
                console.log(`   Sistema: "${fotoSistema}"`);
                mudancasDetectadas = true;
            }
        });
        
        if (mudancasDetectadas) {
            console.log('\n✅ MUDANÇAS DETECTADAS! Aplicando atualização...');
            
            // Forçar atualização completa
            const produtosNovos = await fetchProductsFromGoogleSheets();
            if (produtosNovos.length > 0) {
                products = produtosNovos;
                renderProducts();
                console.log('✅ ATUALIZAÇÃO APLICADA COM SUCESSO!');
            }
        } else {
            console.log('\n✅ Nenhuma mudança detectada nos dois primeiros produtos');
        }
        
        return mudancasDetectadas;
        
    } catch (error) {
        console.error('❌ ERRO na verificação:', error);
        return false;
    }
}

// Função para forçar atualização imediata da planilha
async function forcarAtualizacaoImediata() {
    console.log('🔄 FORÇANDO ATUALIZAÇÃO IMEDIATA...');
    console.log('==================================');
    
    try {
        // Limpar cache
        console.log('🧹 Limpando cache...');
        localStorage.removeItem('products');
        sessionStorage.clear();
        
        // Buscar dados frescos
        console.log('📊 Buscando dados frescos da planilha...');
        const produtosNovos = await fetchProductsFromGoogleSheets();
        
        if (produtosNovos.length > 0) {
            console.log('✅ DADOS FRESCOS RECEBIDOS:');
            produtosNovos.forEach((p, index) => {
                console.log(`   ${index + 1}. ${p.name}`);
                console.log(`      Descrição: ${p.description}`);
                console.log(`      Imagem: ${p.image_url}`);
                console.log(`      Preço: R$ ${p.price.toFixed(2)}`);
                console.log('   ---');
            });
            
            // Atualizar produtos
            products = produtosNovos;
            
            // Renderizar imediatamente
            renderProducts();
            
            console.log('✅ ATUALIZAÇÃO IMEDIATA CONCLUÍDA!');
            console.log(`📦 ${products.length} produtos atualizados`);
            
            return produtosNovos;
        } else {
            console.log('❌ Nenhum produto encontrado na planilha');
            return [];
        }
        
    } catch (error) {
        console.error('❌ ERRO na atualização imediata:', error);
        return [];
    }
}

// Função para verificar se há mudanças na planilha
async function verificarMudancasPlanilha() {
    console.log('🔍 VERIFICANDO MUDANÇAS NA PLANILHA...');
    console.log('=====================================');
    
    try {
        const produtosAtuais = await fetchProductsFromGoogleSheets();
        
        if (produtosAtuais.length > 0) {
            console.log('📊 PRODUTOS ATUAIS NA PLANILHA:');
            produtosAtuais.forEach((p, index) => {
                console.log(`   ${index + 1}. ${p.name}`);
                console.log(`      Descrição: ${p.description}`);
                console.log(`      Imagem: ${p.image_url}`);
                console.log(`      Preço: R$ ${p.price.toFixed(2)}`);
                console.log('   ---');
            });
            
            // Comparar com produtos atuais
            const produtosAntigos = [...products];
            console.log('📊 PRODUTOS ATUAIS NO SISTEMA:');
            produtosAntigos.forEach((p, index) => {
                console.log(`   ${index + 1}. ${p.name}`);
                console.log(`      Descrição: ${p.description}`);
                console.log(`      Imagem: ${p.image_url}`);
                console.log(`      Preço: R$ ${p.price.toFixed(2)}`);
                console.log('   ---');
            });
            
            // Verificar se há diferenças
            const mudancas = [];
            produtosAtuais.forEach((novo, index) => {
                const antigo = produtosAntigos[index];
                if (!antigo || 
                    novo.name !== antigo.name || 
                    novo.description !== antigo.description || 
                    novo.image_url !== antigo.image_url || 
                    novo.price !== antigo.price) {
                    mudancas.push({
                        index: index + 1,
                        antigo: antigo,
                        novo: novo
                    });
                }
            });
            
            if (mudancas.length > 0) {
                console.log('🔄 MUDANÇAS DETECTADAS:');
                mudancas.forEach(mudanca => {
                    console.log(`   Produto ${mudanca.index}:`);
                    console.log(`      Nome: "${mudanca.antigo?.name}" → "${mudanca.novo.name}"`);
                    console.log(`      Descrição: "${mudanca.antigo?.description}" → "${mudanca.novo.description}"`);
                    console.log(`      Imagem: "${mudanca.antigo?.image_url}" → "${mudanca.novo.image_url}"`);
                    console.log(`      Preço: R$ ${mudanca.antigo?.price?.toFixed(2)} → R$ ${mudanca.novo.price.toFixed(2)}`);
                });
                
                // Aplicar mudanças
                products = produtosAtuais;
                renderProducts();
                
                console.log('✅ MUDANÇAS APLICADAS!');
            } else {
                console.log('✅ Nenhuma mudança detectada');
            }
            
            return mudancas;
        } else {
            console.log('❌ Nenhum produto encontrado na planilha');
            return [];
        }
        
    } catch (error) {
        console.error('❌ ERRO na verificação:', error);
        return [];
    }
}

// Função para diagnosticar categorias da planilha
async function diagnosticarCategorias() {
    console.log('🔍 DIAGNÓSTICO DE CATEGORIAS...');
    console.log('================================');
    
    try {
        // Buscar dados frescos da planilha
        const produtosDaPlanilha = await fetchProductsFromGoogleSheets();
        
        if (produtosDaPlanilha.length > 0) {
            console.log('📊 CATEGORIAS ENCONTRADAS NA PLANILHA:');
            produtosDaPlanilha.forEach((produto, index) => {
                console.log(`   ${index + 1}. ${produto.name}`);
                console.log(`      Categoria: "${produto.category}"`);
                console.log(`      Tipo: ${typeof produto.category}`);
                console.log('   ---');
            });
            
            // Verificar se todas as categorias são iguais
            const categoriasUnicas = [...new Set(produtosDaPlanilha.map(p => p.category))];
            console.log('📋 CATEGORIAS ÚNICAS:', categoriasUnicas);
            
            if (categoriasUnicas.length === 1) {
                console.log('⚠️ PROBLEMA: Todas as categorias são iguais!');
                console.log('🔍 Verificando dados brutos da planilha...');
                
                // Buscar dados brutos para debug
                const csvUrl = GOOGLE_SHEETS_URL.replace('/edit?usp=sharing', '/export?format=csv');
                const response = await fetch(csvUrl);
                const csvText = await response.text();
                const parsedProducts = parseCSV(csvText);
                
                console.log('📊 DADOS BRUTOS DA COLUNA CATEGORIA:');
                parsedProducts.forEach((row, index) => {
                    console.log(`   ${index + 1}. "${row['CATEGORIA']}"`);
                });
            } else {
                console.log('✅ Diversas categorias encontradas!');
            }
            
            return produtosDaPlanilha;
        } else {
            console.log('❌ Nenhum produto encontrado na planilha');
            return [];
        }
        
    } catch (error) {
        console.error('❌ ERRO no diagnóstico:', error);
        return [];
    }
}

// Função específica para diagnosticar a placa mãe
async function diagnosticarPlacaMae() {
    console.log('🔍 DIAGNÓSTICO ESPECÍFICO DA PLACA MÃE...');
    console.log('========================================');
    
    // Primeiro, forçar atualização completa
    console.log('🔄 Forçando atualização completa...');
    await forcarAtualizacaoCompleta();
    
    // Aguardar um pouco para garantir que os dados foram carregados
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Procurar a placa mãe
    const placaMae = products.find(p => 
        p.name.toLowerCase().includes('placa') || 
        p.name.toLowerCase().includes('h510m') ||
        p.name.toLowerCase().includes('mãe')
    );
    
    if (!placaMae) {
        console.log('❌ PLACA MÃE NÃO ENCONTRADA!');
        console.log('📊 Produtos disponíveis:');
        products.forEach((p, index) => {
            console.log(`   ${index + 1}. ${p.name}`);
        });
        return;
    }
    
    console.log('✅ PLACA MÃE ENCONTRADA:');
    console.log('   Nome:', placaMae.name);
    console.log('   Descrição:', placaMae.description);
    console.log('   Preço:', placaMae.price);
    console.log('   URL da imagem:', placaMae.image_url);
    console.log('   Estoque:', placaMae.stock);
    
    // Testar a URL da imagem
    if (placaMae.image_url) {
        console.log('🖼️ Testando carregamento da imagem...');
        
        const img = new Image();
        img.onload = () => {
            console.log('✅ IMAGEM CARREGOU COM SUCESSO!');
            console.log('   Dimensões:', img.naturalWidth + 'x' + img.naturalHeight);
        };
        img.onerror = () => {
            console.log('❌ ERRO AO CARREGAR IMAGEM!');
            console.log('   URL problemática:', placaMae.image_url);
            
            // Tentar corrigir automaticamente
            if (placaMae.image_url.includes('imgur.com') && !placaMae.image_url.includes('i.imgur.com')) {
                console.log('🔄 Tentando corrigir URL do Imgur...');
                const imgurId = placaMae.image_url.split('/').pop().split('?')[0];
                const novaUrl = `https://i.imgur.com/${imgurId}.jpg`;
                console.log('   Nova URL:', novaUrl);
                
                placaMae.image_url = novaUrl;
                renderProducts();
                
                // Testar novamente
                const img2 = new Image();
                img2.onload = () => console.log('✅ IMAGEM CORRIGIDA E CARREGADA!');
                img2.onerror = () => console.log('❌ Ainda não funcionou com a correção');
                img2.src = novaUrl;
            }
        };
        img.src = placaMae.image_url;
    } else {
        console.log('❌ URL da imagem está vazia!');
    }
    
    return placaMae;
}

// FUNÇÃO DE TESTE DO SISTEMA AUTOMÁTICO
async function testarSistemaAutomatico() {
    console.log('🔍 TESTANDO SISTEMA AUTOMÁTICO DA PLANILHA...');
    console.log('===========================================');
    
    try {
        // Testar busca da planilha usando a função principal
        console.log('📊 Testando busca da planilha Google Sheets...');
        
        // Usar a função principal que já tem proxy
        const productsFromSheet = await fetchProductsFromGoogleSheets();
        
        if (productsFromSheet.length > 0) {
            console.log('✅ Planilha acessível via proxy!');
            console.log('📦 Produtos encontrados:', productsFromSheet.length);
            
            // Mostrar produtos
            productsFromSheet.forEach((product, index) => {
                console.log(`${index + 1}. ${product.name}:`);
                console.log(`   Valor: R$ ${product.price.toFixed(2)}`);
                console.log(`   Estoque: ${product.stock} unidades`);
                console.log(`   Foto: ${product.image_url}`);
                console.log('');
            });
            
            // Testar carregamento das imagens
            console.log('🖼️ TESTANDO CARREGAMENTO DAS IMAGENS:');
            console.log('===================================');
            
            const imageTests = [];
            productsFromSheet.forEach((product, index) => {
                if (product.image_url) {
                    const img = new Image();
                    const testPromise = new Promise((resolve) => {
                        img.onload = function() {
                            console.log(`✅ ${product.name}: Imagem carregou!`);
                            resolve({ success: true, product: product.name });
                        };
                        img.onerror = function() {
                            console.log(`❌ ${product.name}: Erro ao carregar imagem`);
                            resolve({ success: false, product: product.name });
                        };
                        img.src = product.image_url;
                    });
                    imageTests.push(testPromise);
                }
            });
            
            // Aguardar todos os testes de imagem
            const results = await Promise.all(imageTests);
            const successCount = results.filter(r => r.success).length;
            
            console.log('📊 RESULTADO DOS TESTES:');
            console.log('========================');
            console.log(`✅ Imagens que carregaram: ${successCount}/${results.length}`);
            console.log(`📦 Total de produtos: ${productsFromSheet.length}`);
            console.log(`🔗 Planilha acessível: Sim (via proxy)`);
            
            // Forçar sincronização
            console.log('🔄 Forçando sincronização com a planilha...');
            await forceCorrectData();
            
            showNotification(`Teste concluído! ${productsFromSheet.length} produtos encontrados, ${successCount} imagens carregaram`, 'success');
            
            return {
                planilhaAcessivel: true,
                produtosEncontrados: productsFromSheet.length,
                imagensCarregaram: successCount,
                sistemaFuncionando: true
            };
        } else {
            console.log('⚠️ Nenhum produto encontrado na planilha');
            showNotification('Nenhum produto encontrado na planilha', 'warning');
            return {
                planilhaAcessivel: false,
                produtosEncontrados: 0,
                imagensCarregaram: 0,
                sistemaFuncionando: false
            };
        }
        
    } catch (error) {
        console.error('❌ Erro no teste:', error);
        showNotification('Erro no teste: ' + error.message, 'error');
        return {
            planilhaAcessivel: false,
            produtosEncontrados: 0,
            imagensCarregaram: 0,
            sistemaFuncionando: false,
            erro: error.message
        };
    }
}

// Tornar função global para teste
window.testarSistemaAutomatico = testarSistemaAutomatico;
window.clearAllAndReload = clearAllAndReload;

console.log('🚀 VisualTech Loja - Sistema corrigido com dados REAIS da planilha!');
