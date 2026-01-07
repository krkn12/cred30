import { useState, useEffect } from 'react';

interface Estado {
    id: number;
    sigla: string;
    nome: string;
}

interface Cidade {
    id: number;
    nome: string;
}

export function useLocation() {
    const [ufs, setUfs] = useState<Estado[]>([]);
    const [cities, setCities] = useState<Cidade[]>([]);
    const [loadingUfs, setLoadingUfs] = useState(false);
    const [loadingCities, setLoadingCities] = useState(false);

    // Carregar Estados do IBGE ao iniciar
    useEffect(() => {
        const fetchUfs = async () => {
            setLoadingUfs(true);
            try {
                const response = await fetch('https://servicodados.ibge.gov.br/api/v1/localidades/estados?orderBy=nome');
                const data = await response.json();
                setUfs(data);
            } catch (error) {
                console.error('Erro ao buscar estados:', error);
            } finally {
                setLoadingUfs(false);
            }
        };
        fetchUfs();
    }, []);

    // Função para buscar cidades de um estado
    const fetchCities = async (ufSigla: string) => {
        if (!ufSigla) {
            setCities([]);
            return;
        }
        setLoadingCities(true);
        try {
            const response = await fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${ufSigla}/municipios`);
            const data = await response.json();
            setCities(data);
        } catch (error) {
            console.error('Erro ao buscar cidades:', error);
            setCities([]);
        } finally {
            setLoadingCities(false);
        }
    };

    // Função para buscar endereço por CEP (ViaCEP)
    const fetchAddressByCep = async (cep: string) => {
        try {
            const cleanCep = cep.replace(/\D/g, '');
            if (cleanCep.length !== 8) return null;

            const response = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
            const data = await response.json();

            if (data.erro) return null;

            return {
                uf: data.uf,
                city: data.localidade,
                neighborhood: data.bairro,
                street: data.logradouro
            };
        } catch (error) {
            console.error('Erro no ViaCEP:', error);
            return null;
        }
    };

    return {
        ufs,
        cities,
        loadingUfs,
        loadingCities,
        fetchCities,
        fetchAddressByCep
    };
}
