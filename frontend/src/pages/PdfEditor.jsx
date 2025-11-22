import { useState, useRef } from 'react';
import { PDFDocument } from 'pdf-lib';
import {
    DndContext,
    closestCenter,
    PointerSensor,
    useSensor,
    useSensors,
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    useSortable,
    verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, FileText, XCircle, UploadCloud, Trash2, Save } from 'lucide-react';

// Componente para cada item na lista, que pode ser arrastado
function SortableFileItem({ file, id, onRemove }) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
    } = useSortable({ id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            {...attributes}
            className="flex items-center justify-between bg-gray-100 p-3 rounded-lg border"
        >
            <div className="flex items-center gap-3">
                <button {...listeners} className="cursor-grab p-1 text-gray-500">
                    <GripVertical size={20} />
                </button>
                <FileText size={20} className="text-primary" />
                <span className="font-medium text-secondary">{file.name}</span>
            </div>
            <button onClick={() => onRemove(id)} className="p-1 text-red-500 hover:text-red-700">
                <XCircle size={20} />
            </button>
        </div>
    );
}

const PdfEditor = () => {
    const [files, setFiles] = useState([]);
    const [isMerging, setIsMerging] = useState(false);
    const fileInputRef = useRef(null);
    const sensors = useSensors(useSensor(PointerSensor));

    const handleFileChange = (event) => {
        const selectedFiles = Array.from(event.target.files);
        const newFiles = selectedFiles.map(file => ({
            id: `${file.name}-${Date.now()}`,
            file,
        }));
        setFiles(currentFiles => [...currentFiles, ...newFiles]);
        event.target.value = null; // Permite selecionar o mesmo arquivo novamente
    };

    const handleRemoveFile = (idToRemove) => {
        setFiles(currentFiles => currentFiles.filter(f => f.id !== idToRemove));
    };

    const handleClearAll = () => {
        setFiles([]);
    };

    const handleMergePdfs = async () => {
        if (files.length < 1) {
            alert('Por favor, selecione ao menos um arquivo PDF.');
            return;
        }
        setIsMerging(true);
        try {
            const mergedPdf = await PDFDocument.create();
            for (const fileObj of files) {
                const arrayBuffer = await fileObj.file.arrayBuffer();
                const pdf = await PDFDocument.load(arrayBuffer);
                const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
                copiedPages.forEach((page) => mergedPdf.addPage(page));
            }
            const pdfBytes = await mergedPdf.save();
            const blob = new Blob([pdfBytes], { type: 'application/pdf' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = `documento-unificado-${Date.now()}.pdf`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } catch (error) {
            console.error("Erro ao juntar os PDFs:", error);
            alert("Ocorreu um erro ao juntar os PDFs. Verifique se todos os arquivos são válidos.");
        } finally {
            setIsMerging(false);
        }
    };

    const handleDragEnd = (event) => {
        const { active, over } = event;
        if (active.id !== over.id) {
            setFiles((items) => {
                const oldIndex = items.findIndex(item => item.id === active.id);
                const newIndex = items.findIndex(item => item.id === over.id);
                return arrayMove(items, oldIndex, newIndex);
            });
        }
    };

    return (
        <div id="pdf-editor-view" className="fade-in p-6 space-y-6 max-w-4xl mx-auto">
            <div className="bg-surface p-6 rounded-lg shadow-md">
                <h2 className="text-xl font-bold text-secondary mb-2">Juntar e Organizar PDFs</h2>
                <p className="text-text-secondary mb-4">Selecione, arraste para reordenar e salve seus arquivos em um só.</p>
                <div className="flex flex-col sm:flex-row items-center gap-4 flex-wrap">
                    <input
                        type="file"
                        multiple
                        accept=".pdf"
                        ref={fileInputRef}
                        onChange={handleFileChange}
                        className="hidden"
                    />
                    <button onClick={() => fileInputRef.current.click()} className="w-full sm:w-auto cursor-pointer py-2 px-4 rounded-md shadow-sm text-sm font-medium btn-primary whitespace-nowrap flex items-center justify-center gap-2">
                        <UploadCloud size={18} /> Selecionar Arquivos
                    </button>
                    <div className="flex-grow"></div>
                    <button onClick={handleClearAll} disabled={files.length === 0 || isMerging} className="w-full sm:w-auto py-2 px-4 rounded-md shadow-sm text-sm font-medium bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                        <Trash2 size={18} /> Limpar Tudo
                    </button>
                    <button onClick={handleMergePdfs} disabled={files.length === 0 || isMerging} className="w-full sm:w-auto py-2 px-4 rounded-md shadow-sm text-sm font-medium bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                        <Save size={18} /> {isMerging ? 'Salvando...' : 'Salvar PDF Combinado'}
                    </button>
                </div>
            </div>

            <div className="bg-surface p-4 rounded-lg shadow-md min-h-[200px]">
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                    <SortableContext items={files.map(f => f.id)} strategy={verticalListSortingStrategy}>
                        <div className="space-y-3">
                            {files.map(fileObj => (
                                <SortableFileItem key={fileObj.id} id={fileObj.id} file={fileObj.file} onRemove={handleRemoveFile} />
                            ))}
                        </div>
                    </SortableContext>
                </DndContext>
                {files.length === 0 && (
                    <div className="flex flex-col items-center justify-center text-center text-gray-400 h-full p-10">
                        <FileText size={48} className="mb-4" />
                        <h3 className="font-semibold text-lg text-gray-600">Nenhum arquivo selecionado</h3>
                        <p>Use o botão "Selecionar Arquivos" para começar.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default PdfEditor;
