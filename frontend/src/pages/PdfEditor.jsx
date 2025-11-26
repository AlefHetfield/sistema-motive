import { useState, useRef, useEffect } from 'react';
import { PDFDocument } from 'pdf-lib';
import {
    DndContext,
    closestCenter,
    PointerSensor,
    useSensor,
    useSensors,
    DragOverlay,
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    useSortable,
    rectSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, FileText, XCircle, UploadCloud, Trash2, Save, Loader2, FileInput, Eye, Move, AlertCircle, CheckCircle2 } from 'lucide-react';

// Componente para cada página do PDF com preview
function SortablePageItem({ page, id, index, onRemove, isLoading }) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.3 : 1,
        zIndex: isDragging ? 1000 : 1,
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={`relative group bg-white rounded-2xl shadow-sm border-2 transition-all duration-200 overflow-hidden ${
                isDragging 
                    ? 'border-primary/30 shadow-xl scale-105' 
                    : 'border-gray-100 hover:border-primary/50 hover:shadow-lg'
            }`}
        >
            {/* Badge de número da página */}
            <div className="absolute top-2 left-2 z-10 bg-primary text-white text-xs font-bold px-2.5 py-1 rounded-full shadow-sm">
                {index + 1}
            </div>

            {/* Botão de remover */}
            <button
                onClick={(e) => {
                    e.stopPropagation();
                    onRemove(id);
                }}
                className="absolute top-2 right-2 z-10 p-1.5 bg-red-500 text-white rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600 hover:scale-110 duration-300"
                title="Remover página"
            >
                <XCircle size={16} />
            </button>

            {/* Handle de arrastar */}
            <div
                {...attributes}
                {...listeners}
                className="absolute inset-0 cursor-grab active:cursor-grabbing z-[5]"
            >
                <div className="absolute bottom-2 right-2 bg-gray-800/80 text-white p-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity">
                    <Move size={16} />
                </div>
            </div>

            {/* Preview da página */}
            <div className="aspect-[1/1.414] bg-white flex items-center justify-center relative overflow-hidden">
                {isLoading ? (
                    <div className="flex flex-col items-center gap-2 text-gray-400">
                        <Loader2 size={32} className="animate-spin" />
                        <span className="text-xs">Carregando...</span>
                    </div>
                ) : page.fileUrl ? (
                    <div className="w-full h-full relative bg-white">
                        <iframe
                            src={`${page.fileUrl}#page=${page.pageNumber}&toolbar=0&navpanes=0&scrollbar=0&view=FitH&zoom=150`}
                            className="w-full h-full border-0 pointer-events-none"
                            title={`Preview página ${index + 1}`}
                            style={{ 
                                transform: 'scale(1.1)', 
                                transformOrigin: 'center center',
                                filter: 'contrast(1.05) brightness(1.02)'
                            }}
                        />
                    </div>
                ) : (
                    <div className="flex flex-col items-center gap-3 text-gray-400">
                        <FileText size={48} className="text-gray-300" />
                        <span className="text-xs font-medium">PDF</span>
                    </div>
                )}
            </div>

            {/* Info do arquivo */}
            <div className="p-3 border-t border-gray-100 bg-gray-50/50">
                <p className="text-xs font-medium text-gray-700 truncate" title={page.fileName}>
                    {page.fileName}
                </p>
                <p className="text-xs text-gray-500">Página {page.pageNumber}</p>
            </div>
        </div>
    );
}

const PdfEditor = () => {
    const [pages, setPages] = useState([]); // Array de páginas individuais com preview
    const [isMerging, setIsMerging] = useState(false);
    const [isLoadingPages, setIsLoadingPages] = useState(false);
    const [activeId, setActiveId] = useState(null);
    const [successMessage, setSuccessMessage] = useState('');
    const fileInputRef = useRef(null);
    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 8, // Distância mínima para iniciar o drag (evita cliques acidentais)
            },
        })
    );

    const handleFileChange = async (event) => {
        const selectedFiles = Array.from(event.target.files);
        if (selectedFiles.length === 0) return;

        setIsLoadingPages(true);
        const newPages = [];

        try {
            for (const file of selectedFiles) {
                // Carregar PDF para contar páginas
                const arrayBuffer = await file.arrayBuffer();
                const pdfDoc = await PDFDocument.load(arrayBuffer);
                const pageCount = pdfDoc.getPageCount();

                // Criar URL do blob para preview
                const fileUrl = URL.createObjectURL(file);

                // Criar entrada para cada página
                for (let i = 0; i < pageCount; i++) {
                    const pageId = `${file.name}-page-${i + 1}-${Date.now()}-${Math.random()}`;
                    newPages.push({
                        id: pageId,
                        file: file,
                        fileUrl: fileUrl,
                        fileName: file.name,
                        pageNumber: i + 1,
                        totalPages: pageCount,
                        isLoading: false,
                    });
                }
            }

            setPages(current => [...current, ...newPages]);
        } catch (error) {
            console.error('Erro ao processar arquivos:', error);
            alert('Erro ao processar os arquivos PDF. Verifique se são válidos.');
        } finally {
            setIsLoadingPages(false);
            event.target.value = null;
        }
    };

    const handleRemovePage = (idToRemove) => {
        setPages(current => current.filter(p => p.id !== idToRemove));
    };

    const handleClearAll = () => {
        setPages([]);
        setSuccessMessage('');
    };

    const handleMergePdfs = async () => {
        if (pages.length < 1) {
            alert('Por favor, adicione ao menos uma página PDF.');
            return;
        }

        setIsMerging(true);
        setSuccessMessage('');

        try {
            const mergedPdf = await PDFDocument.create();

            // Agrupar páginas por arquivo para otimizar
            const fileCache = new Map();

            for (const pageData of pages) {
                // Carregar PDF do cache ou criar novo
                let sourcePdf;
                if (fileCache.has(pageData.file)) {
                    sourcePdf = fileCache.get(pageData.file);
                } else {
                    const arrayBuffer = await pageData.file.arrayBuffer();
                    sourcePdf = await PDFDocument.load(arrayBuffer);
                    fileCache.set(pageData.file, sourcePdf);
                }

                // Copiar apenas a página específica
                const [copiedPage] = await mergedPdf.copyPages(sourcePdf, [pageData.pageNumber - 1]);
                mergedPdf.addPage(copiedPage);
            }

            const pdfBytes = await mergedPdf.save();
            const blob = new Blob([pdfBytes], { type: 'application/pdf' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = `documento-unificado-${Date.now()}.pdf`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            setSuccessMessage(`PDF gerado com sucesso! ${pages.length} página${pages.length > 1 ? 's' : ''} combinada${pages.length > 1 ? 's' : ''}.`);
            setTimeout(() => setSuccessMessage(''), 5000);
        } catch (error) {
            console.error("Erro ao juntar os PDFs:", error);
            alert("Ocorreu um erro ao juntar os PDFs. Verifique se todos os arquivos são válidos.");
        } finally {
            setIsMerging(false);
        }
    };

    const handleDragStart = (event) => {
        setActiveId(event.active.id);
    };

    const handleDragEnd = (event) => {
        const { active, over } = event;
        
        setActiveId(null);

        if (over && active.id !== over.id) {
            setPages((items) => {
                const oldIndex = items.findIndex(item => item.id === active.id);
                const newIndex = items.findIndex(item => item.id === over.id);
                return arrayMove(items, oldIndex, newIndex);
            });
        }
    };

    const handleDragCancel = () => {
        setActiveId(null);
    };

    // Limpar mensagem de sucesso quando páginas mudarem
    useEffect(() => {
        if (successMessage && pages.length === 0) {
            setSuccessMessage('');
        }
    }, [pages.length, successMessage]);

    const activePage = activeId ? pages.find(p => p.id === activeId) : null;

    return (
        <div id="pdf-editor-view" className="fade-in p-6">
            {/* Header */}
            <div className="mb-8">
                <h2 className="text-3xl font-bold text-gray-800 mb-2">Editor de PDF</h2>
                <p className="text-gray-500">Combine, reorganize e gerencie páginas de PDFs com visualização em tempo real</p>
            </div>

            {/* Barra de ações */}
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 mb-6 animate-fade-in">
                <div className="flex flex-col sm:flex-row items-center gap-4">
                    <input
                        type="file"
                        multiple
                        accept=".pdf"
                        ref={fileInputRef}
                        onChange={handleFileChange}
                        className="hidden"
                        disabled={isLoadingPages || isMerging}
                    />
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isLoadingPages || isMerging}
                        className="w-full sm:w-auto py-2.5 px-5 bg-primary hover:bg-primary/90 text-white rounded-2xl font-medium shadow-sm hover:shadow-md transition-all duration-300 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isLoadingPages ? (
                            <>
                                <Loader2 size={18} className="animate-spin" />
                                Processando...
                            </>
                        ) : (
                            <>
                                <FileInput size={18} />
                                Adicionar PDFs
                            </>
                        )}
                    </button>

                    <div className="flex-1 hidden sm:block" />

                    {pages.length > 0 && (
                        <div className="flex items-center gap-2 text-sm text-gray-600 bg-gray-50 px-4 py-2 rounded-full border border-gray-200">
                            <Eye size={16} />
                            <span className="font-medium">{pages.length} página{pages.length !== 1 ? 's' : ''}</span>
                        </div>
                    )}

                    <button
                        onClick={handleClearAll}
                        disabled={pages.length === 0 || isMerging || isLoadingPages}
                        className="w-full sm:w-auto py-2.5 px-5 bg-red-50 hover:bg-red-100 text-red-600 rounded-2xl font-medium transition-all duration-300 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed border border-red-200"
                    >
                        <Trash2 size={18} />
                        Limpar Tudo
                    </button>

                    <button
                        onClick={handleMergePdfs}
                        disabled={pages.length === 0 || isMerging || isLoadingPages}
                        className="w-full sm:w-auto py-2.5 px-5 bg-green-600 hover:bg-green-700 text-white rounded-2xl font-medium shadow-sm hover:shadow-md transition-all duration-300 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isMerging ? (
                            <>
                                <Loader2 size={18} className="animate-spin" />
                                Gerando...
                            </>
                        ) : (
                            <>
                                <Save size={18} />
                                Salvar PDF
                            </>
                        )}
                    </button>
                </div>
            </div>

            {/* Mensagem de sucesso */}
            {successMessage && (
                <div className="mb-6 bg-green-50 border border-green-200 text-green-700 p-4 rounded-2xl flex items-center gap-3 animate-fade-in">
                    <CheckCircle2 size={20} className="text-green-600 flex-shrink-0" />
                    <p className="text-sm font-medium">{successMessage}</p>
                </div>
            )}

            {/* Grid de páginas com drag and drop */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 min-h-[400px] animate-fade-in" style={{ animationDelay: '100ms' }}>
                {pages.length === 0 && !isLoadingPages ? (
                    <div className="flex flex-col items-center justify-center text-center text-gray-400 h-[400px]">
                        <div className="p-6 bg-gray-50 rounded-full mb-4">
                            <FileText size={64} className="text-gray-300" />
                        </div>
                        <h3 className="font-semibold text-xl text-gray-600 mb-2">Nenhum arquivo carregado</h3>
                        <p className="text-gray-500 mb-6 max-w-md">
                            Clique em "Adicionar PDFs" para começar a combinar e organizar suas páginas
                        </p>
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            className="py-2.5 px-6 bg-primary hover:bg-primary/90 text-white rounded-2xl font-medium shadow-sm hover:shadow-md transition-all duration-300 flex items-center gap-2"
                        >
                            <FileInput size={18} />
                            Adicionar PDFs
                        </button>
                    </div>
                ) : (
                    <>
                        <div className="mb-4 flex items-center justify-between">
                            <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                                <GripVertical size={20} className="text-gray-400" />
                                Arraste para reordenar
                            </h3>
                            {pages.length > 0 && (
                                <div className="text-sm text-gray-500">
                                    Total: {pages.length} página{pages.length !== 1 ? 's' : ''}
                                </div>
                            )}
                        </div>

                        <DndContext
                            sensors={sensors}
                            collisionDetection={closestCenter}
                            onDragStart={handleDragStart}
                            onDragEnd={handleDragEnd}
                            onDragCancel={handleDragCancel}
                            measuring={{
                                droppable: {
                                    strategy: 'always',
                                }
                            }}
                        >
                            <SortableContext items={pages.map(p => p.id)} strategy={rectSortingStrategy}>
                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 auto-rows-max">
                                    {pages.map((page, index) => (
                                        <SortablePageItem
                                            key={page.id}
                                            id={page.id}
                                            page={page}
                                            index={index}
                                            onRemove={handleRemovePage}
                                            isLoading={page.isLoading}
                                        />
                                    ))}
                                </div>
                            </SortableContext>

                            {/* Overlay durante o arrasto - centralizado no cursor */}
                            <DragOverlay 
                                dropAnimation={null}
                                style={{ 
                                    cursor: 'grabbing',
                                }}
                            >
                                {activePage ? (
                                    <div 
                                        className="bg-white rounded-2xl shadow-2xl border-2 border-primary overflow-hidden relative" 
                                        style={{ 
                                            width: '160px',
                                            transform: 'translate(-50%, -50%)',
                                            pointerEvents: 'none'
                                        }}
                                    >
                                        {/* Badge de número */}
                                        <div className="absolute top-2 left-2 z-10 bg-primary text-white text-xs font-bold px-2.5 py-1 rounded-full shadow-lg">
                                            {activePage.pageNumber}
                                        </div>
                                        
                                        {/* Preview */}
                                        <div className="aspect-[1/1.414] bg-white flex items-center justify-center relative overflow-hidden">
                                            {activePage.fileUrl ? (
                                                <div className="w-full h-full relative bg-white">
                                                    <iframe
                                                        src={`${activePage.fileUrl}#page=${activePage.pageNumber}&toolbar=0&navpanes=0&scrollbar=0&view=FitH&zoom=150`}
                                                        className="w-full h-full border-0 pointer-events-none"
                                                        title={`Preview arrastando`}
                                                        style={{ 
                                                            transform: 'scale(1.1)', 
                                                            transformOrigin: 'center center',
                                                            filter: 'contrast(1.05) brightness(1.02)'
                                                        }}
                                                    />
                                                </div>
                                            ) : (
                                                <div className="flex flex-col items-center gap-2 text-primary">
                                                    <FileText size={36} />
                                                    <span className="text-xs font-bold">Página {activePage.pageNumber}</span>
                                                </div>
                                            )}
                                        </div>
                                        
                                        {/* Info do arquivo */}
                                        <div className="p-2 border-t border-gray-100 bg-primary/5">
                                            <p className="text-xs font-medium text-gray-700 truncate text-center">
                                                Pág. {activePage.pageNumber}
                                            </p>
                                        </div>
                                    </div>
                                ) : null}
                            </DragOverlay>
                        </DndContext>
                    </>
                )}
            </div>

            {/* Dica de uso */}
            {pages.length > 1 && (
                <div className="mt-6 bg-blue-50 border border-blue-200 text-blue-700 p-4 rounded-2xl flex items-start gap-3 animate-fade-in" style={{ animationDelay: '200ms' }}>
                    <AlertCircle size={20} className="text-blue-600 flex-shrink-0 mt-0.5" />
                    <div className="text-sm">
                        <p className="font-medium mb-1">Dica:</p>
                        <p>Arraste as páginas para reorganizá-las antes de gerar o PDF final. Você pode remover páginas individuais clicando no ícone vermelho.</p>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PdfEditor;
