import React from 'react';
import { Shield, Database, Clock, UserCheck, Mail, ArrowLeft } from 'lucide-react';

// ==========================================================
// 📄 Página de Política de Privacidade (LGPD)
// Criado para compliance com Lei 13.709/18 (LGPD)
// ==========================================================

interface PrivacyPolicyViewProps {
    onBack: () => void; // Função para voltar à tela anterior
}

export const PrivacyPolicyView: React.FC<PrivacyPolicyViewProps> = ({ onBack }) => {
    return (
        <div className="min-h-screen bg-zinc-950 text-white p-4 sm:p-8">
            {/* Header */}
            <div className="max-w-4xl mx-auto">
                <button
                    onClick={onBack}
                    className="flex items-center gap-2 text-zinc-400 hover:text-white mb-6 transition-colors"
                >
                    <ArrowLeft size={20} />
                    Voltar
                </button>

                <div className="flex items-center gap-4 mb-8">
                    <div className="w-14 h-14 bg-primary-500/10 rounded-2xl flex items-center justify-center border border-primary-500/20">
                        <Shield className="text-primary-500" size={28} />
                    </div>
                    <div>
                        <h1 className="text-2xl sm:text-3xl font-bold">Política de Privacidade</h1>
                        <p className="text-zinc-500 text-sm">Lei Geral de Proteção de Dados (LGPD)</p>
                    </div>
                </div>

                {/* Conteúdo */}
                <div className="space-y-8">
                    {/* Seção 1 - Introdução */}
                    <section className="bg-zinc-900/50 p-6 rounded-2xl border border-zinc-800">
                        <h2 className="text-lg font-bold text-primary-400 mb-3 flex items-center gap-2">
                            <Shield size={20} />
                            1. Introdução
                        </h2>
                        <p className="text-zinc-400 text-sm leading-relaxed">
                            Esta Política de Privacidade descreve como o <strong className="text-white">Cred30</strong> coleta, utiliza, armazena e protege seus dados pessoais em conformidade com a Lei nº 13.709/2018 (Lei Geral de Proteção de Dados Pessoais - LGPD).
                        </p>
                    </section>

                    {/* Seção 2 - Dados Coletados */}
                    <section className="bg-zinc-900/50 p-6 rounded-2xl border border-zinc-800">
                        <h2 className="text-lg font-bold text-primary-400 mb-3 flex items-center gap-2">
                            <Database size={20} />
                            2. Dados Pessoais Coletados
                        </h2>
                        <div className="grid sm:grid-cols-2 gap-4 mt-4">
                            <div className="bg-zinc-800/50 p-4 rounded-xl">
                                <h3 className="font-semibold text-white mb-2">Dados de Identificação</h3>
                                <ul className="text-zinc-400 text-sm space-y-1">
                                    <li>• Nome completo</li>
                                    <li>• CPF ou CNPJ</li>
                                    <li>• Endereço de e-mail</li>
                                    <li>• Número de WhatsApp</li>
                                </ul>
                            </div>
                            <div className="bg-zinc-800/50 p-4 rounded-xl">
                                <h3 className="font-semibold text-white mb-2">Dados Financeiros</h3>
                                <ul className="text-zinc-400 text-sm space-y-1">
                                    <li>• Chave Pix (para saques)</li>
                                    <li>• Histórico de transações</li>
                                    <li>• Saldo de licenças e pontos</li>
                                </ul>
                            </div>
                            <div className="bg-zinc-800/50 p-4 rounded-xl">
                                <h3 className="font-semibold text-white mb-2">Dados de Localização</h3>
                                <ul className="text-zinc-400 text-sm space-y-1">
                                    <li>• Endereço de entrega (Marketplace)</li>
                                    <li>• Coordenadas GPS (entregas)</li>
                                    <li>• Cidade e Estado</li>
                                </ul>
                            </div>
                            <div className="bg-zinc-800/50 p-4 rounded-xl">
                                <h3 className="font-semibold text-white mb-2">Dados Técnicos</h3>
                                <ul className="text-zinc-400 text-sm space-y-1">
                                    <li>• Endereço IP</li>
                                    <li>• Navegador utilizado</li>
                                    <li>• Data e hora de acesso</li>
                                </ul>
                            </div>
                        </div>
                    </section>

                    {/* Seção 3 - Finalidade */}
                    <section className="bg-zinc-900/50 p-6 rounded-2xl border border-zinc-800">
                        <h2 className="text-lg font-bold text-primary-400 mb-3">3. Finalidade do Tratamento</h2>
                        <p className="text-zinc-400 text-sm leading-relaxed mb-4">
                            Os dados são tratados com base no <strong className="text-white">Art. 7º, inciso V da LGPD</strong> (execução de contrato) e para as seguintes finalidades:
                        </p>
                        <ul className="text-zinc-400 text-sm space-y-2">
                            <li>✅ Execução do contrato associativo e operações de apoio mútuo</li>
                            <li>✅ Processamento de saques e depósitos via Pix</li>
                            <li>✅ Verificação de identidade (KYC) para prevenção a fraudes</li>
                            <li>✅ Operações de Marketplace (compra, venda e entregas)</li>
                            <li>✅ Comunicação sobre transações e atualizações do sistema</li>
                            <li>✅ Cumprimento de obrigações legais e regulatórias</li>
                        </ul>
                    </section>

                    {/* Seção 4 - Tempo de Retenção */}
                    <section className="bg-zinc-900/50 p-6 rounded-2xl border border-zinc-800">
                        <h2 className="text-lg font-bold text-primary-400 mb-3 flex items-center gap-2">
                            <Clock size={20} />
                            4. Tempo de Retenção
                        </h2>
                        <p className="text-zinc-400 text-sm leading-relaxed">
                            Seus dados serão mantidos enquanto você for um associado ativo. Após a exclusão da conta:
                        </p>
                        <ul className="text-zinc-400 text-sm space-y-2 mt-3">
                            <li>• <strong className="text-white">Dados financeiros:</strong> 5 anos (obrigação fiscal)</li>
                            <li>• <strong className="text-white">Logs de auditoria:</strong> 2 anos (segurança)</li>
                            <li>• <strong className="text-white">Dados de identificação:</strong> Imediatamente excluídos</li>
                        </ul>
                    </section>

                    {/* Seção 5 - Direitos do Titular */}
                    <section className="bg-zinc-900/50 p-6 rounded-2xl border border-zinc-800">
                        <h2 className="text-lg font-bold text-primary-400 mb-3 flex items-center gap-2">
                            <UserCheck size={20} />
                            5. Seus Direitos (Art. 18 LGPD)
                        </h2>
                        <p className="text-zinc-400 text-sm leading-relaxed mb-4">
                            Você tem direito a:
                        </p>
                        <div className="grid sm:grid-cols-2 gap-3">
                            <div className="bg-emerald-500/10 border border-emerald-500/20 p-3 rounded-xl text-sm text-emerald-300">
                                ✓ Confirmar a existência de tratamento
                            </div>
                            <div className="bg-emerald-500/10 border border-emerald-500/20 p-3 rounded-xl text-sm text-emerald-300">
                                ✓ Acessar seus dados pessoais
                            </div>
                            <div className="bg-emerald-500/10 border border-emerald-500/20 p-3 rounded-xl text-sm text-emerald-300">
                                ✓ Corrigir dados incompletos ou desatualizados
                            </div>
                            <div className="bg-emerald-500/10 border border-emerald-500/20 p-3 rounded-xl text-sm text-emerald-300">
                                ✓ Solicitar anonimização ou exclusão
                            </div>
                            <div className="bg-emerald-500/10 border border-emerald-500/20 p-3 rounded-xl text-sm text-emerald-300">
                                ✓ Portabilidade dos dados
                            </div>
                            <div className="bg-emerald-500/10 border border-emerald-500/20 p-3 rounded-xl text-sm text-emerald-300">
                                ✓ Revogar consentimento a qualquer momento
                            </div>
                        </div>
                    </section>

                    {/* Seção 6 - Compartilhamento */}
                    <section className="bg-zinc-900/50 p-6 rounded-2xl border border-zinc-800">
                        <h2 className="text-lg font-bold text-primary-400 mb-3">6. Compartilhamento de Dados</h2>
                        <p className="text-zinc-400 text-sm leading-relaxed">
                            <strong className="text-red-400">Seus dados NÃO são vendidos a terceiros.</strong> O compartilhamento ocorre apenas:
                        </p>
                        <ul className="text-zinc-400 text-sm space-y-2 mt-3">
                            <li>• Com processadores de pagamento (Pix) para executar transações</li>
                            <li>• Com entregadores parceiros para operações de logística</li>
                            <li>• Com autoridades competentes quando exigido por lei</li>
                        </ul>
                    </section>

                    {/* Seção 7 - Segurança */}
                    <section className="bg-zinc-900/50 p-6 rounded-2xl border border-zinc-800">
                        <h2 className="text-lg font-bold text-primary-400 mb-3">7. Segurança dos Dados</h2>
                        <p className="text-zinc-400 text-sm leading-relaxed">
                            Implementamos medidas técnicas e organizacionais para proteger seus dados:
                        </p>
                        <ul className="text-zinc-400 text-sm space-y-2 mt-3">
                            <li>🔒 Criptografia de senhas (Bcrypt)</li>
                            <li>🔒 Conexões HTTPS obrigatórias</li>
                            <li>🔒 Autenticação JWT com tokens de curta duração</li>
                            <li>🔒 Logs de auditoria para rastreabilidade</li>
                            <li>🔒 Verificação KYC para operações sensíveis</li>
                        </ul>
                    </section>

                    {/* Seção 8 - Contato */}
                    <section className="bg-primary-500/10 p-6 rounded-2xl border border-primary-500/20">
                        <h2 className="text-lg font-bold text-primary-400 mb-3 flex items-center gap-2">
                            <Mail size={20} />
                            8. Contato do Encarregado (DPO)
                        </h2>
                        <p className="text-zinc-400 text-sm leading-relaxed mb-4">
                            Para exercer seus direitos ou esclarecer dúvidas sobre o tratamento de dados:
                        </p>
                        <div className="bg-zinc-900/50 p-4 rounded-xl">
                            <p className="text-white font-semibold">Encarregado de Proteção de Dados</p>
                            <p className="text-zinc-400 text-sm">E-mail: privacidade@cred30.com.br</p>
                            <p className="text-zinc-400 text-sm">WhatsApp: (91) 99999-0000</p>
                        </div>
                    </section>

                    {/* Rodapé */}
                    <div className="text-center py-6 border-t border-zinc-800">
                        <p className="text-zinc-500 text-xs">
                            Última atualização: 02/02/2026 • Versão 1.0
                        </p>
                        <p className="text-zinc-600 text-xs mt-1">
                            Cred30 - Plataforma de Apoio Mútuo
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PrivacyPolicyView;
