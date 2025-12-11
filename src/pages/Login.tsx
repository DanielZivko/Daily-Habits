import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { CheckCircle2, Loader2, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

export const Login = () => {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [message, setMessage] = useState<{ type: 'error' | 'success', text: string } | null>(null);
  const navigate = useNavigate();

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({
          email,
          password,
        });
        if (error) throw error;
        setMessage({ type: 'success', text: 'Verifique seu e-mail para confirmar o cadastro!' });
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        navigate('/');
      }
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Ocorreu um erro.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8 space-y-6">
        <div className="flex items-center justify-center gap-2 mb-8">
          <CheckCircle2 className="h-10 w-10 text-blue-500" />
          <h1 className="text-2xl font-bold text-gray-900">Daily Habits</h1>
        </div>

        <div className="space-y-2 text-center">
          <h2 className="text-xl font-semibold text-gray-800">
            {isSignUp ? 'Criar conta' : 'Bem-vindo de volta'}
          </h2>
          <p className="text-gray-500 text-sm">
            {isSignUp 
              ? 'Registre-se para sincronizar seus hábitos na nuvem' 
              : 'Entre para acessar seus dados sincronizados'}
          </p>
        </div>

        <form onSubmit={handleAuth} className="space-y-4">
          <div>
            <Input
              type="email"
              placeholder="E-mail"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full"
            />
          </div>
          <div>
            <Input
              type="password"
              placeholder="Senha"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full"
              minLength={6}
            />
          </div>

          {message && (
            <div className={`p-3 rounded-lg text-sm ${
              message.type === 'error' ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'
            }`}>
              {message.text}
            </div>
          )}

          <Button 
            type="submit" 
            className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg"
            disabled={loading}
          >
            {loading ? <Loader2 className="animate-spin h-5 w-5 mx-auto" /> : (isSignUp ? 'Cadastrar' : 'Entrar')}
          </Button>
        </form>

        <div className="text-center text-sm text-gray-600">
          <button 
            onClick={() => setIsSignUp(!isSignUp)}
            className="text-blue-600 hover:underline font-medium"
          >
            {isSignUp ? 'Já tem uma conta? Entre aqui' : 'Não tem conta? Crie uma agora'}
          </button>
        </div>
        
        <div className="text-center pt-4 border-t border-gray-100">
           <Link to="/" className="flex items-center justify-center gap-2 text-gray-500 hover:text-gray-700 transition-colors text-sm">
             <ArrowLeft className="h-4 w-4" /> Voltar ao modo Offline
           </Link>
        </div>
      </div>
    </div>
  );
};
