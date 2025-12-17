import React, { useState, useEffect } from 'react';
import { ArrowRight, TrendingUp, Shield, Zap, Users, Star, ChevronRight, Check, ArrowUpRight, ArrowDownLeft, Wallet, PiggyBank, CreditCard } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const WelcomePage = () => {
  const [currentFeature, setCurrentFeature] = useState(0);
  const [isLoaded, setIsLoaded] = useState(false);
  const navigate = useNavigate();

  const features = [
    {
      icon: <TrendingUp className="w-8 h-8" />,
      title: "Rendimentos Diários",
      description: "Acompanhe seu dinheiro crescendo todos os dias com taxas competitivas",
      color: "from-emerald-500 to-emerald-600"
    },
    {
      icon: <Shield className="w-8 h-8" />,
      title: "Segurança Máxima",
      description: "Seus dados e investimentos protegidos com criptografia de ponta",
      color: "from-blue-500 to-blue-600"
    },
    {
      icon: <Zap className="w-8 h-8" />,
      title: "Empréstimos Rápidos",
      description: "Crédito aprovado em minutos com taxas justas e parcelas flexíveis",
      color: "from-purple-500 to-purple-600"
    },
    {
      icon: <Users className="w-8 h-8" />,
      title: "Sistema VIP",
      description: "Níveis exclusivos com benefícios crescentes para nossos clientes",
      color: "from-orange-500 to-orange-600"
    }
  ];

  const benefits = [
    "Investimento a partir de R$ 50,00",
    "Rendimentos variáveis diários",
    "Saque rápido e seguro via PIX",
    "Empréstimos com aprovação imediata",
    "Sistema de indicações com recompensas",
    "Níveis VIP com vantagens exclusivas"
  ];

  const stats = [
    { value: "20%", label: "Retorno Anual Médio" },
    { value: "R$ 50", label: "Investimento Mínimo" },
    { value: "24h", label: "Saques via PIX" },
    { value: "99,9%", label: "Uptime do Sistema" }
  ];

  useEffect(() => {
    setIsLoaded(true);
    const interval = setInterval(() => {
      setCurrentFeature((prev) => (prev + 1) % features.length);
    }, 4000);
    return () => clearInterval(interval);
  }, [features.length]);

  const handleGetStarted = () => {
    navigate('/auth');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950 text-white overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(6,182,212,0.1),transparent_50%)]"></div>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,rgba(34,211,238,0.05),transparent_50%)]"></div>
      
      {/* Navigation */}
      <nav className={`relative z-10 px-6 py-4 transition-all duration-700 ${isLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'}`}>
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-gradient-to-tr from-cyan-400 to-cyan-600 rounded-xl flex items-center justify-center text-black font-bold text-xl shadow-[0_0_20px_rgba(34,211,238,0.4)]">
              C
            </div>
            <span className="text-2xl font-bold">Cred<span className="text-cyan-400">30</span></span>
          </div>
          <button
            onClick={handleGetStarted}
            className="bg-cyan-500 hover:bg-cyan-400 text-black font-semibold px-6 py-2 rounded-xl transition-all duration-300 hover:scale-105 hover:shadow-[0_0_20px_rgba(34,211,238,0.4)]"
          >
            Começar Agora
          </button>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative z-10 px-6 py-20 md:py-32">
        <div className="max-w-7xl mx-auto">
          <div className={`text-center mb-16 transition-all duration-1000 delay-300 ${isLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
            <h1 className="text-5xl md:text-7xl font-bold mb-6 bg-gradient-to-r from-white via-cyan-200 to-white bg-clip-text text-transparent">
              Sua Liberdade
              <br />
              <span className="text-cyan-400">Financeira</span>
            </h1>
            <p className="text-xl md:text-2xl text-zinc-300 mb-8 max-w-3xl mx-auto leading-relaxed">
              Invista, cresça e alcance seus objetivos com a plataforma financeira que 
              <span className="text-cyan-400 font-semibold"> simplifica seu futuro</span>
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <button
                onClick={handleGetStarted}
                className="group relative bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-400 hover:to-cyan-500 text-black font-bold py-4 px-8 rounded-2xl transition-all duration-300 hover:scale-105 hover:shadow-[0_0_30px_rgba(34,211,238,0.5)] flex items-center gap-3"
              >
                Começar Agora
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </button>
              <button
                onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })}
                className="bg-zinc-800 hover:bg-zinc-700 text-white font-semibold py-4 px-8 rounded-2xl transition-all duration-300 hover:scale-105 border border-zinc-700"
              >
                Descobrir Mais
              </button>
            </div>
          </div>

          {/* Stats Cards */}
          <div className={`grid grid-cols-2 md:grid-cols-4 gap-4 mb-16 transition-all duration-1000 delay-500 ${isLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
            {stats.map((stat, index) => (
              <div key={index} className="bg-zinc-800/50 backdrop-blur-sm border border-zinc-700 rounded-2xl p-6 text-center hover:bg-zinc-800/70 transition-all duration-300 hover:scale-105">
                <div className="text-3xl md:text-4xl font-bold text-cyan-400 mb-2">{stat.value}</div>
                <div className="text-sm text-zinc-400">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Carousel */}
      <section id="features" className="relative z-10 px-6 py-20 bg-zinc-900/50 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-4">
              Recursos que
              <span className="text-cyan-400"> Transformam</span>
            </h2>
            <p className="text-xl text-zinc-300 max-w-2xl mx-auto">
              Ferramentas poderosas para gerenciar seu dinheiro de forma inteligente
            </p>
          </div>

          <div className="relative h-96 mb-12">
            {features.map((feature, index) => (
              <div
                key={index}
                className={`absolute inset-0 flex items-center justify-center transition-all duration-700 ${
                  index === currentFeature
                    ? 'opacity-100 scale-100'
                    : 'opacity-0 scale-95'
                }`}
              >
                <div className="bg-gradient-to-br from-zinc-800 to-zinc-900 border border-zinc-700 rounded-3xl p-8 max-w-md w-full text-center">
                  <div className={`w-20 h-20 bg-gradient-to-tr ${feature.color} rounded-2xl flex items-center justify-center text-white mx-auto mb-6`}>
                    {feature.icon}
                  </div>
                  <h3 className="text-2xl font-bold mb-4">{feature.title}</h3>
                  <p className="text-zinc-300 leading-relaxed">{feature.description}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Carousel Indicators */}
          <div className="flex justify-center gap-2">
            {features.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentFeature(index)}
                title={`Ir para recurso ${index + 1}`}
                className={`w-2 h-2 rounded-full transition-all duration-300 ${
                  index === currentFeature
                    ? 'bg-cyan-400 w-8'
                    : 'bg-zinc-600 hover:bg-zinc-500'
                }`}
              />
            ))}
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="relative z-10 px-6 py-20">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-4xl md:text-5xl font-bold mb-6">
                Por que escolher a
                <span className="text-cyan-400"> Cred30</span>
              </h2>
              <p className="text-xl text-zinc-300 mb-8 leading-relaxed">
                Criamos uma plataforma financeira completa que une simplicidade, 
                segurança e rentabilidade para você alcançar seus objetivos mais rapidamente.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {benefits.map((benefit, index) => (
                  <div key={index} className="flex items-start gap-3">
                    <Check className="w-6 h-6 text-cyan-400 flex-shrink-0 mt-0.5" />
                    <span className="text-zinc-300">{benefit}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="relative">
              <div className="bg-gradient-to-br from-cyan-500/20 to-cyan-600/20 rounded-3xl p-8 border border-cyan-500/30">
                <div className="space-y-6">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-cyan-500/20 rounded-xl flex items-center justify-center">
                      <Wallet className="w-6 h-6 text-cyan-400" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-white">Carteira Digital</h3>
                      <p className="text-zinc-400">Gerencie todo seu dinheiro em um só lugar</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-emerald-500/20 rounded-xl flex items-center justify-center">
                      <PiggyBank className="w-6 h-6 text-emerald-400" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-white">Investimentos Inteligentes</h3>
                      <p className="text-zinc-400">Rendimentos diários que superam a poupança</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-purple-500/20 rounded-xl flex items-center justify-center">
                      <CreditCard className="w-6 h-6 text-purple-400" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-white">Crédito Flexível</h3>
                      <p className="text-zinc-400">Empréstimos com taxas justas e aprovação rápida</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative z-10 px-6 py-20">
        <div className="max-w-4xl mx-auto text-center">
          <div className="bg-gradient-to-br from-cyan-500/10 to-cyan-600/10 rounded-3xl p-12 border border-cyan-500/30 backdrop-blur-sm">
            <h2 className="text-4xl md:text-5xl font-bold mb-6">
              Pronto para transformar
              <span className="text-cyan-400"> seu futuro?</span>
            </h2>
            <p className="text-xl text-zinc-300 mb-8 max-w-2xl mx-auto">
              Junte-se a milhares de brasileiros que já estão alcançando 
              sua liberdade financeira com a Cred30
            </p>
            <button
              onClick={handleGetStarted}
              className="group bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-400 hover:to-cyan-500 text-black font-bold py-4 px-8 rounded-2xl transition-all duration-300 hover:scale-105 hover:shadow-[0_0_30px_rgba(34,211,238,0.5)] flex items-center gap-3 mx-auto"
            >
              Abrir Minha Conta Gratuita
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </button>
            <p className="text-zinc-400 mt-4 text-sm">
              Sem taxas ocultas • Cancelamento a qualquer momento • Suporte 24/7
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 px-6 py-12 border-t border-zinc-800">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 bg-gradient-to-tr from-cyan-400 to-cyan-600 rounded-lg flex items-center justify-center text-black font-bold text-sm">
                  C
                </div>
                <span className="text-xl font-bold">Cred<span className="text-cyan-400">30</span></span>
              </div>
              <p className="text-zinc-400 text-sm">
                Sua liberdade financeira começa aqui.
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-white mb-4">Produto</h4>
              <ul className="space-y-2 text-zinc-400 text-sm">
                <li><a href="#" className="hover:text-cyan-400 transition-colors">Investimentos</a></li>
                <li><a href="#" className="hover:text-cyan-400 transition-colors">Empréstimos</a></li>
                <li><a href="#" className="hover:text-cyan-400 transition-colors">Carteira Digital</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-white mb-4">Empresa</h4>
              <ul className="space-y-2 text-zinc-400 text-sm">
                <li><a href="#" className="hover:text-cyan-400 transition-colors">Sobre nós</a></li>
                <li><a href="#" className="hover:text-cyan-400 transition-colors">Segurança</a></li>
                <li><a href="#" className="hover:text-cyan-400 transition-colors">Blog</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-white mb-4">Suporte</h4>
              <ul className="space-y-2 text-zinc-400 text-sm">
                <li><a href="#" className="hover:text-cyan-400 transition-colors">Central de Ajuda</a></li>
                <li><a href="#" className="hover:text-cyan-400 transition-colors">Contato</a></li>
                <li><a href="#" className="hover:text-cyan-400 transition-colors">FAQ</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-zinc-800 pt-8 text-center text-zinc-400 text-sm">
            <p>&copy; 2024 Cred30. Todos os direitos reservados.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default WelcomePage;