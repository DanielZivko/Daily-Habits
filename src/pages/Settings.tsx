import React, { useRef, useState } from 'react';
import { db } from '../db/db';
import { Header } from '../components/Header';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Download, Upload, Trash2, ArrowLeft, RefreshCw, Check } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
// import { useRegisterSW } from 'virtual:pwa-register/react';

export const Settings: React.FC = () => {
    const { user } = useAuth();
    const currentUserId = user ? user.id : 'guest';
    
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
    const [updateStatus, setUpdateStatus] = useState<'idle' | 'checking' | 'available' | 'latest'>('idle');

    // Mock hook for build without PWA plugin
    const needRefresh = [false];
    const updateServiceWorker = (_reload?: boolean) => {};

    const handleExport = async () => {
        try {
            setIsLoading(true);
            const groups = await db.groups.where('userId').equals(currentUserId).toArray();
            const tasks = await db.tasks.where('userId').equals(currentUserId).toArray();
            
            const data = {
                version: 1,
                date: new Date().toISOString(),
                groups,
                tasks
            };
            
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `daily-habits-backup-${currentUserId === 'guest' ? 'guest' : 'user'}-${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            setMessage({ type: 'success', text: 'Backup exportado com sucesso!' });
        } catch (error) {
            console.error('Export failed:', error);
            setMessage({ type: 'error', text: 'Erro ao exportar backup.' });
        } finally {
            setIsLoading(false);
            setTimeout(() => setMessage(null), 3000);
        }
    };

    const handleImportClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        if (confirm('Atenção: Importar um backup irá substituir todos os dados atuais. Deseja continuar?')) {
            try {
                setIsLoading(true);
                const text = await file.text();
                const data = JSON.parse(text);
                
                if (!data.groups || !data.tasks) {
                    throw new Error('Formato de arquivo inválido');
                }

                await db.transaction('rw', db.groups, db.tasks, async () => {
                    // Limpa dados apenas do usuário atual
                    await db.groups.where('userId').equals(currentUserId).delete();
                    await db.tasks.where('userId').equals(currentUserId).delete();
                    
                    // Prepara dados para importação, garantindo userId correto
                    const groupsToImport = data.groups.map((g: any) => ({ ...g, userId: currentUserId }));
                    const tasksToImport = data.tasks.map((t: any) => ({ ...t, userId: currentUserId }));
                    
                    await db.groups.bulkAdd(groupsToImport);
                    await db.tasks.bulkAdd(tasksToImport);
                });

                setMessage({ type: 'success', text: 'Dados importados com sucesso!' });
            } catch (error) {
                console.error('Import failed:', error);
                setMessage({ type: 'error', text: 'Erro ao importar backup. Verifique o arquivo.' });
            } finally {
                setIsLoading(false);
                if (fileInputRef.current) fileInputRef.current.value = '';
                setTimeout(() => setMessage(null), 3000);
            }
        } else {
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handleClearData = async () => {
        if (confirm('Tem certeza absoluta? Esta ação não pode ser desfeita e apagará TODOS os seus dados.')) {
             try {
                setIsLoading(true);
                await db.transaction('rw', db.groups, db.tasks, async () => {
                    await db.groups.where('userId').equals(currentUserId).delete();
                    await db.tasks.where('userId').equals(currentUserId).delete();
                });
                setMessage({ type: 'success', text: 'Todos os seus dados foram apagados.' });
             } catch (error) {
                 setMessage({ type: 'error', text: 'Erro ao limpar dados.' });
             } finally {
                 setIsLoading(false);
                 setTimeout(() => setMessage(null), 3000);
             }
        }
    }

    const checkForUpdates = async () => {
        setUpdateStatus('checking');
        
        if ('serviceWorker' in navigator) {
            try {
                const registration = await navigator.serviceWorker.ready;
                await registration.update();
                
                // If needRefresh becomes true, it will be handled by the hook state
                // Otherwise we assume latest after a short delay if no update found
                setTimeout(() => {
                    if (!needRefresh) {
                        setUpdateStatus('latest');
                        setTimeout(() => setUpdateStatus('idle'), 3000);
                    }
                }, 1000);
                
            } catch (e) {
                console.error("Error checking for updates:", e);
                setUpdateStatus('idle');
                setMessage({ type: 'error', text: 'Erro ao verificar atualizações.' });
            }
        } else {
             setUpdateStatus('idle');
             setMessage({ type: 'error', text: 'Service Worker não suportado ou em modo de desenvolvimento.' });
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 pb-20">
            <Header />
            
            <main className="mx-auto max-w-3xl px-4 py-8 md:px-8">
                <div className="mb-6 flex items-center gap-4">
                     <Link to="/" className="flex items-center gap-2 text-gray-500 hover:text-gray-900">
                        <ArrowLeft size={20} />
                        Voltar
                     </Link>
                     <h1 className="text-2xl font-bold text-gray-900">Configurações</h1>
                </div>

                {message && (
                    <div className={`mb-6 p-4 rounded-lg ${message.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                        {message.text}
                    </div>
                )}

                <div className="space-y-6">
                    <section>
                        <h2 className="mb-4 text-lg font-semibold text-gray-800">Gerenciamento de Dados</h2>
                        <Card className="space-y-4">
                            <div className="flex items-center justify-between p-2">
                                <div>
                                    <h3 className="font-medium">Exportar Backup</h3>
                                    <p className="text-sm text-gray-500">Baixe uma cópia de todos os seus dados.</p>
                                </div>
                                <Button onClick={handleExport} disabled={isLoading} variant="outline" className="flex gap-2">
                                    <Download size={16} />
                                    Exportar
                                </Button>
                            </div>

                            <div className="border-t border-gray-100 pt-4 flex items-center justify-between p-2">
                                <div>
                                    <h3 className="font-medium">Importar Backup</h3>
                                    <p className="text-sm text-gray-500">Restaure seus dados de um arquivo JSON.</p>
                                </div>
                                <div>
                                    <input 
                                        type="file" 
                                        accept=".json" 
                                        ref={fileInputRef} 
                                        className="hidden" 
                                        onChange={handleFileChange}
                                    />
                                    <Button onClick={handleImportClick} disabled={isLoading} variant="outline" className="flex gap-2">
                                        <Upload size={16} />
                                        Importar
                                    </Button>
                                </div>
                            </div>

                            <div className="border-t border-gray-100 pt-4 flex items-center justify-between p-2">
                                <div>
                                    <h3 className="font-medium text-red-600">Apagar Tudo</h3>
                                    <p className="text-sm text-gray-500">Remove permanentemente todos os grupos e tarefas.</p>
                                </div>
                                <Button onClick={handleClearData} disabled={isLoading} variant="danger" className="flex gap-2">
                                    <Trash2 size={16} />
                                    Limpar
                                </Button>
                            </div>
                        </Card>
                    </section>
                    
                    <section>
                         <h2 className="mb-4 text-lg font-semibold text-gray-800">Sobre</h2>
                         <Card className="p-6">
                            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                                <div>
                                    <p className="text-gray-600 font-medium">Daily Habits PWA v1.3.1</p>
                                    <p className="text-sm text-gray-400 mt-1">Desenvolvido com React, Vite e Dexie.js</p>
                                </div>
                                
                                <Button 
                                    variant="outline" 
                                    size="sm"
                                    onClick={() => needRefresh ? updateServiceWorker(true) : checkForUpdates()}
                                    disabled={updateStatus === 'checking'}
                                    className={needRefresh ? "bg-blue-50 text-blue-600 border-blue-200" : ""}
                                >
                                    {needRefresh ? (
                                        <>
                                            <Download size={16} className="mr-2" />
                                            Baixar e Instalar
                                        </>
                                    ) : updateStatus === 'checking' ? (
                                        <>
                                            <RefreshCw size={16} className="mr-2 animate-spin" />
                                            Verificando...
                                        </>
                                    ) : updateStatus === 'latest' ? (
                                        <>
                                            <Check size={16} className="mr-2 text-green-500" />
                                            Versão mais recente
                                        </>
                                    ) : (
                                        <>
                                            <RefreshCw size={16} className="mr-2" />
                                            Procurar Atualizações
                                        </>
                                    )}
                                </Button>
                            </div>
                         </Card>
                    </section>
                </div>
            </main>
        </div>
    );
};
