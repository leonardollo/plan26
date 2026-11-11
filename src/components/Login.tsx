
import React, { useState } from 'react';
import { authService } from '../hooks/usePlanData';

const Login: React.FC = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  
  const handleAuthAction = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    setMessage('');

    try {
        if (isSignUp) {
            if (name.trim() === '') {
                throw new Error("O nome e obrigatorio para o cadastro.");
            }
            await authService.signup(email, password, name);
            setMessage("Conta criada com sucesso! Você sera redirecionado.");
        } else {
            await authService.login(email, password);
        }
    } catch (error: any) {
        console.error(error);
        if (error.code === 'auth/invalid-credential' || error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
             setError('Usuario nao encontrado ou senha incorreta. Se e seu primeiro acesso, clique em "Cadastre-se" abaixo.');
        } else if (error.code === 'auth/email-already-in-use') {
             setError('Este email ja esta cadastrado. Tente fazer login.');
        } else {
             setError(error.message || 'Ocorreu um erro. Verifique suas credenciais.');
        }
        setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    setError('');
    setMessage('');
    try {
        await authService.loginWithGoogle();
    } catch (error: any) {
        setError(error.message || 'Falha no login com Google.');
        setIsLoading(false);
    }
  }
  
  const handlePasswordReset = async () => {
    if (!email) {
        setError("Por favor, insira seu e-mail para recuperar a senha.");
        return;
    }
    setIsLoading(true);
    setError('');
    setMessage('');
    try {
        await authService.resetPassword(email);
        setMessage("E-mail de recuperacao enviado! Verifique sua caixa de entrada.");
    } catch (error: any) {
        setError(error.message || "Falha ao enviar e-mail de recuperacao.");
    } finally {
        setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex">
      {/* Left side - Branding */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-center items-center p-12 relative overflow-hidden">
        {/* Background pattern */}
        <div className="absolute inset-0 opacity-5">
          <div className="absolute top-20 left-20 w-72 h-72 bg-brand-orange rounded-full blur-3xl"></div>
          <div className="absolute bottom-20 right-20 w-96 h-96 bg-orange-400 rounded-full blur-3xl"></div>
        </div>
        
        <div className="relative z-10 text-center max-w-md">
          <img src="/logo-gi.png" alt="Gestão de Impacto" className="h-16 w-auto object-contain mx-auto mb-6" />
          <h2 className="text-lg font-semibold text-brand-orange uppercase tracking-[0.25em] mb-4">Planejamento Estratégico</h2>
          <p className="text-gray-400 text-lg leading-relaxed">
            Planejamento estratégico inteligente para transformar sua empresa, ano a ano.
          </p>
          
          <div className="mt-12 grid grid-cols-3 gap-6">
            <div className="text-center">
              <div className="text-2xl font-extrabold text-white">21</div>
              <div className="text-xs text-gray-500 mt-1">Modulos</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-extrabold text-brand-orange">IA</div>
              <div className="text-xs text-gray-500 mt-1">Integrada</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-extrabold text-white">360</div>
              <div className="text-xs text-gray-500 mt-1">Visão completa</div>
            </div>
          </div>
        </div>
      </div>

      {/* Right side - Form */}
      <div className="w-full lg:w-1/2 flex flex-col justify-center px-6 sm:px-12 lg:px-16">
        {/* Mobile logo */}
        <div className="lg:hidden text-center mb-8">
          <img src="/logo-gi.png" alt="Gestão de Impacto" className="h-12 w-auto object-contain mx-auto mb-3" />
          <span className="text-xs font-semibold text-brand-orange uppercase tracking-[0.2em]">Planejamento Estratégico</span>
        </div>

        <div className="w-full max-w-md mx-auto">
          <h2 className="text-2xl font-extrabold text-white mb-1">
            {isSignUp ? 'Crie sua conta' : 'Bem-vindo de volta'}
          </h2>
          <p className="text-gray-400 mb-8">
            {isSignUp ? 'Comece seu planejamento estratégico agora' : 'Acesse seu planejamento estratégico'}
          </p>

          {/* Google Sign In */}
          <button
            onClick={handleGoogleSignIn}
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-3 py-3 px-4 bg-white rounded-xl text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50 shadow-sm"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Continuar com Google
          </button>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-700" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-3 bg-gray-900 text-gray-500">ou</span>
            </div>
          </div>

          <form className="space-y-4" onSubmit={handleAuthAction}>
            {isSignUp && (
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1.5">Nome completo</label>
                  <input
                    type="text"
                    autoComplete="name"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:border-brand-orange focus:ring-1 focus:ring-brand-orange text-sm"
                    placeholder="Seu nome"
                  />
                </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">E-mail</label>
              <input
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:border-brand-orange focus:ring-1 focus:ring-brand-orange text-sm"
                placeholder="seu@email.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Senha</label>
              <input
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:border-brand-orange focus:ring-1 focus:ring-brand-orange text-sm"
                placeholder="••••••••"
              />
            </div>

            {!isSignUp && (
              <div className="text-right">
                <button type="button" onClick={handlePasswordReset} className="text-sm text-brand-orange hover:text-orange-400 font-medium">
                  Esqueceu a senha?
                </button>
              </div>
            )}
            
            {error && (
                <div className="p-3 bg-red-900/30 border border-red-800 rounded-xl">
                    <p className="text-sm text-red-400 text-center">{error}</p>
                </div>
            )}
            {message && (
                <div className="p-3 bg-green-900/30 border border-green-800 rounded-xl">
                    <p className="text-sm text-green-400 text-center">{message}</p>
                </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 px-4 bg-brand-orange text-white font-bold rounded-xl hover:bg-orange-700 focus:ring-2 focus:ring-offset-2 focus:ring-brand-orange focus:ring-offset-gray-900 disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors text-sm shadow-lg shadow-brand-orange/20"
            >
              {isLoading ? 'Aguarde...' : (isSignUp ? 'Criar conta' : 'Entrar')}
            </button>
          </form>

          <p className="text-center mt-6 text-sm text-gray-500">
            {isSignUp ? 'Ja tem uma conta?' : 'Nao tem uma conta?'}{' '}
            <button type="button" onClick={() => { setIsSignUp(!isSignUp); setError(''); setMessage(''); }} className="text-brand-orange hover:text-orange-400 font-semibold">
              {isSignUp ? 'Fazer login' : 'Cadastre-se'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
