import { useState, useRef } from 'react';
import { Award, Download, ShieldCheck, X } from 'lucide-react';

interface CertificateModalProps {
    isOpen: boolean;
    onClose: () => void;
    studentName: string;
    courseTitle: string;
    instructorName: string;
    completionDate: string; // DD/MM/YYYY
    hours: number;
}

export function CertificateModal({ isOpen, onClose, studentName, courseTitle, instructorName, completionDate, hours }: CertificateModalProps) {
    const componentRef = useRef<HTMLDivElement>(null);

    const handlePrint = () => {
        const printContent = componentRef.current;
        if (!printContent) return;

        // Simples print window logic
        // Idealmente usaríamos uma lib ou apenas CSS media print, mas aqui vamos forçar o browser print
        window.print();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-[200] p-4 overflow-y-auto print:p-0 print:bg-white print:fixed print:inset-0">
            <div className="w-full max-w-4xl relative animate-in fade-in duration-300 print:w-full print:max-w-none">

                {/* Header Actions (Hidden on Print) */}
                <div className="flex justify-between items-center mb-6 px-4 print:hidden">
                    <h4 className="text-emerald-400 font-bold uppercase tracking-widest text-sm flex items-center gap-2">
                        <Award size={18} /> Certificado Disponível
                    </h4>
                    <div className="flex gap-2">
                        <button
                            onClick={handlePrint}
                            className="bg-emerald-500 hover:bg-emerald-400 text-black px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition shadow-lg shadow-emerald-500/20"
                        >
                            <Download size={16} /> Imprimir / Salvar PDF
                        </button>
                        <button onClick={onClose} className="bg-zinc-800 text-zinc-400 hover:text-white p-2 rounded-lg transition">
                            <X size={20} />
                        </button>
                    </div>
                </div>

                {/* CERTIFICATE CANVAS */}
                <div ref={componentRef} id="certificate-print" className="bg-[#fffcf5] text-[#1a1a1a] aspect-[1.414/1] relative shadow-2xl overflow-hidden print:shadow-none print:w-[297mm] print:h-[210mm] print:m-0 print:p-0">

                    {/* Ornamental Border */}
                    <div className="absolute inset-4 border-[12px] border-[#daae51] border-double print:inset-0"></div>
                    <div className="absolute inset-8 border border-[#daae51]/40 print:inset-4"></div>

                    {/* Corner Ornaments */}
                    <div className="absolute top-8 left-8 w-16 h-16 border-t-4 border-l-4 border-[#daae51]"></div>
                    <div className="absolute top-8 right-8 w-16 h-16 border-t-4 border-r-4 border-[#daae51]"></div>
                    <div className="absolute bottom-8 left-8 w-16 h-16 border-b-4 border-l-4 border-[#daae51]"></div>
                    <div className="absolute bottom-8 right-8 w-16 h-16 border-b-4 border-r-4 border-[#daae51]"></div>

                    {/* Content */}
                    <div className="relative z-10 h-full flex flex-col items-center justify-center text-center p-16 space-y-8 print:p-12">

                        {/* Logo / Badge */}
                        <div className="mb-4">
                            <Award size={64} className="text-[#daae51] inline-block mb-2" />
                            <h2 className="text-[#daae51] tracking-[0.5em] text-xs font-black uppercase font-serif">Academy Cred30</h2>
                        </div>

                        <h1 className="text-4xl sm:text-5xl font-serif font-bold text-[#2c3e50] tracking-wide uppercase">
                            Certificado de Conclusão
                        </h1>

                        <p className="text-lg text-zinc-600 font-serif italic max-w-2xl mx-auto leading-relaxed">
                            Certificamos que, para os devidos fins de comprovação de competência técnica e dedicação acadêmica,
                        </p>

                        <div className="w-full max-w-3xl py-4 border-b border-[#daae51]/30">
                            <span className="text-3xl sm:text-5xl font-black text-[#1a1a1a] font-serif block uppercase tracking-wide">
                                {studentName}
                            </span>
                        </div>

                        <p className="text-lg text-zinc-600 font-serif italic max-w-2xl mx-auto leading-relaxed">
                            concluiu com êxito o curso de qualificação profissional em:
                        </p>

                        <h3 className="text-2xl sm:text-3xl font-bold text-[#daae51] font-serif max-w-3xl uppercase">
                            {courseTitle}
                        </h3>

                        <p className="text-base text-zinc-500 font-serif mt-2">
                            Carga Horária: <strong>{hours} horas</strong> &bull; Concluído em: <strong>{completionDate}</strong>
                        </p>

                        {/* Signatures */}
                        <div className="grid grid-cols-2 gap-24 mt-16 w-full max-w-3xl px-12">
                            <div className="text-center">
                                <div className="h-px bg-[#1a1a1a] w-full mb-3 opacity-30"></div>
                                <p className="font-bold text-[#1a1a1a] font-serif uppercase text-sm">{instructorName}</p>
                                <p className="text-[10px] text-zinc-500 uppercase tracking-widest">Instrutor Responsável</p>
                            </div>
                            <div className="text-center">
                                <div className="h-px bg-[#1a1a1a] w-full mb-3 opacity-30"></div>
                                <p className="font-bold text-[#1a1a1a] font-serif uppercase text-sm">Cred30 Platform</p>
                                <p className="text-[10px] text-zinc-500 uppercase tracking-widest">Validação Institucional</p>
                            </div>
                        </div>

                        {/* ID */}
                        <div className="absolute bottom-8 right-12 text-right">
                            <div className="flex items-center gap-1 text-[#daae51] justify-end opacity-80">
                                <ShieldCheck size={14} />
                                <span className="text-[10px] font-bold uppercase tracking-widest">Verificado</span>
                            </div>
                            <p className="text-[8px] font-mono text-zinc-400 mt-1">
                                ID: CERT-{Math.random().toString(36).substring(2, 9).toUpperCase()}-{new Date().getFullYear()}
                            </p>
                        </div>
                    </div>
                </div>

                <p className="text-center text-zinc-500 text-xs mt-6 italic print:hidden">
                    Este certificado atesta a conclusão e o cumprimento da carga horária estabelecida.
                </p>
            </div>
        </div>
    );
}
