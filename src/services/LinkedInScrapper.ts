import axios, { AxiosRequestConfig } from 'axios';
import { IProfile, IExperience, ICertification, IEducation, ISkill } from '../types/Profile';
import * as fs from 'fs';

export class LinkedInScrapper {
    private cookie: string;
    private baseUrl: string;
    private username: string;

    constructor(cookie: string) {
        this.cookie = cookie;
        this.baseUrl = '';
        this.username = '';
        console.log('Cookie recebido:', cookie);
    }

    async extrairPerfil(username: string): Promise<IProfile> {
        try {
            this.username = username;
            this.baseUrl = `https://www.linkedin.com/in/${username}`;
            
            console.log('Iniciando extração com cookie:', {
                li_at: this.extractCookieValue('li_at')?.substring(0, 20) + '...',
                jsessionid: this.extractCookieValue('JSESSIONID')
            });

            await this.debugToken();

            const isValid = await this.validateToken();
            if (!isValid) {
                throw new Error('Token do LinkedIn inválido ou expirado');
            }

            const [experiences, certifications, education, skills] = await Promise.all([
                this.fetchExperiences(),
                this.fetchCertifications(),
                this.fetchEducation(),
                this.fetchSkills()
            ]);
            
            console.log('Dados extraídos:', {
                experiences: experiences.length,
                certifications: certifications.length,
                education: education.length,
                skills: skills.length
            });

            return {
                experiences: this.mapSkillsToExperiences(experiences, skills),
                certifications,
                education,
                skills
            };
        } catch (error) {
            console.error('Erro na extração:', error);
            throw error;
        }
    }

    private async fetchExperiences(): Promise<IExperience[]> {
        try {
            console.log('\n=== Buscando Experiências via API ===');
            const apiUrl = `https://www.linkedin.com/voyager/api/identity/profiles/${this.username}/positions`;
            console.log('URL:', apiUrl);
            console.log('Config:', this.getAxiosConfig());
            
            const response = await axios.get(apiUrl, this.getAxiosConfig());
            
            console.log('\n=== Resposta da API ===');
            console.log('Status:', response.status);
            console.log('Headers:', response.headers);
            console.log('Data:', JSON.stringify(response.data, null, 2));
            
            fs.writeFileSync('debug_api_response.json', JSON.stringify(response.data, null, 2));
            return this.parseExperiencesFromApi(response.data);
        } catch (error) {
            console.error('\n=== Erro na API ===');
            console.error('Erro completo:', error);
            if (axios.isAxiosError(error)) {
                console.error('Status:', error.response?.status);
                console.error('Mensagem:', error.message);
                console.error('Resposta:', error.response?.data);
                console.error('Headers:', error.response?.headers);
                console.error('Config:', error.config);
            }
            throw error; // Propaga o erro ao invés de retornar array vazio
        }
    }

    private parseExperiencesFromApi(apiResponse: any): IExperience[] {
        try {
            const elements = apiResponse?.included || [];
            
            return elements
                .filter((el: any) => el.$type === 'com.linkedin.voyager.identity.profile.Position')
                .map((exp: any) => {
                    const company = elements.find((el: any) => 
                        el.$type === 'com.linkedin.voyager.entities.shared.MiniCompany' && 
                        el.entityUrn === exp.companyUrn
                    );

                    return {
                        empresa: exp.companyName || company?.name || '',
                        cargo: exp.title || '',
                        periodo: this.formatPeriod(exp.timePeriod),
                        descricao: exp.description || '',
                        skills: [] // Será preenchido posteriormente pelo mapSkillsToExperiences
                    };
                })
                    .sort((a: IExperience, b: IExperience) => {
                    const [aStart, aEnd] = this.extractDatesFromPeriod(a.periodo);
                    const [bStart, bEnd] = this.extractDatesFromPeriod(b.periodo);
                    return (bEnd || new Date()).getTime() - (aEnd || new Date()).getTime();
                });
        } catch (error) {
            console.error('Erro ao processar experiências:', error);
            return [];
        }
    }

    private formatPeriod(period: any): string {
        if (!period) return '';
        
        const start = period.startDate ? 
            `${this.getMonthName(period.startDate.month)}/${period.startDate.year}` : '';
        const end = period.endDate ? 
            `${this.getMonthName(period.endDate.month)}/${period.endDate.year}` : 'Presente';
        
        return `${start} - ${end}`;
    }

    private getMonthName(month: number): string {
        const months = [
            'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
            'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'
        ];
        return months[month - 1] || '';
    }

    private extractDatesFromPeriod(period: string): [Date, Date | null] {
        const [start, end] = period.split(' - ');
        const parseDate = (str: string): Date => {
            const [month, year] = str.split('/');
            const monthIndex = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
                               'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
                               .indexOf(month);
            return new Date(parseInt(year), monthIndex);
        };
        
        return [
            parseDate(start),
            end === 'Presente' ? null : parseDate(end)
        ];
    }

    private async fetchCertifications(): Promise<ICertification[]> {
        try {
            console.log('\n=== Buscando Certificações via API ===');
            const apiUrl = `https://www.linkedin.com/voyager/api/identity/profiles/${this.username}/certifications`;
            const response = await axios.get(apiUrl, this.getAxiosConfig());
            
            return response.data?.included
                ?.filter((item: any) => item.$type === 'com.linkedin.voyager.identity.profile.Certification')
                ?.map((cert: any) => ({
                    nome: cert.name || '',
                    empresa: cert.authority || '',
                    dataEmissao: cert.timePeriod?.startDate ? 
                        `${cert.timePeriod.startDate.month}/${cert.timePeriod.startDate.year}` : ''
                })) || [];
        } catch (error) {
            console.error('Erro ao buscar certificações:', error);
            return [];
        }
    }

    private async fetchEducation(): Promise<IEducation[]> {
        try {
            console.log('\n=== Buscando Educação via API ===');
            const apiUrl = `https://www.linkedin.com/voyager/api/identity/profiles/${this.username}/educations`;
            const response = await axios.get(apiUrl, this.getAxiosConfig());
            
            return response.data?.included
                ?.filter((item: any) => item.$type === 'com.linkedin.voyager.identity.profile.Education')
                ?.map((edu: any) => ({
                    instituicao: edu.schoolName || '',
                    curso: edu.fieldOfStudy || '',
                    periodo: this.formatDateRange({
                        start: edu.timePeriod?.startDate,
                        end: edu.timePeriod?.endDate
                    })
                })) || [];
        } catch (error) {
            console.error('Erro ao buscar educação:', error);
            return [];
        }
    }

    private async fetchSkills(): Promise<ISkill[]> {
        try {
            console.log('\n=== Buscando Skills via API ===');
            const apiUrl = `https://www.linkedin.com/voyager/api/identity/profiles/${this.username}/skills`;
            
            const response = await axios.get(apiUrl, {
                ...this.getAxiosConfig(),
                headers: {
                    ...this.getCommonHeaders(),
                    'x-li-page-instance': 'urn:li:page:d_flagship3_profile_view_base_skills_details'
                }
            });

            return response.data?.included
                ?.filter((item: any) => item.$type === 'com.linkedin.voyager.identity.profile.Skill')
                ?.map((skill: any) => ({
                    nome: skill.name || '',
                    nivel: this.extractSkillLevel(skill)
                })) || [];
        } catch (error) {
            console.error('Erro ao buscar skills:', error);
            if (axios.isAxiosError(error)) {
                console.error('Status:', error.response?.status);
                console.error('Headers:', error.response?.headers);
                console.error('Data:', error.response?.data);
            }
            return [];
        }
    }

    private async fetchProfileHtml(url: string): Promise<string> {
        try {
            console.log('\n=== Iniciando Requisição ===');
            console.log(`URL: ${url}`);
            
            // Formata os cookies principais
            const cookieString = [
                `li_at=${this.extractCookieValue('li_at')}`,
                `JSESSIONID=${this.extractCookieValue('JSESSIONID')}`,
                `bcookie=${this.extractCookieValue('bcookie')}`
            ].join('; ');

            const headers = {
                'Cookie': cookieString,
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/121.0.0.0',
                'Accept': 'text/html,application/xhtml+xml',
                'csrf-token': this.extractCookieValue('JSESSIONID')?.replace(/"/g, '')
            };

            console.log('\n=== Cookies ===');
            console.log('li_at:', this.extractCookieValue('li_at')?.substring(0, 20) + '...');
            console.log('JSESSIONID:', this.extractCookieValue('JSESSIONID')?.substring(0, 20) + '...');

            const response = await axios.get(url, { 
                headers,
                maxRedirects: 5,
                validateStatus: (status) => status < 400
            });
            
            console.log('\n=== Resposta ===');
            console.log('Status:', response.status);
            console.log('Tamanho do conteúdo:', response.data.length, 'caracteres');
            
            // Salva apenas os primeiros 500 caracteres para debug
            fs.writeFileSync('debug_response_preview.html', response.data.substring(0, 500));
            
            return response.data;

        } catch (error) {
            console.error('\n=== Erro na Requisição ===');
            if (axios.isAxiosError(error)) {
                console.error('Status:', error.response?.status);
                console.error('Mensagem:', error.message);
            }
            return '';
        }
    }

    private extractCookieValue(name: string): string | undefined {
        const cookieString = this.cookie;
        const regex = new RegExp(`${name}=([^;]+)`);
        const matches = cookieString.match(regex);
        return matches ? matches[1] : undefined;
    }

    private formatDateRange(dateRange: any): string {
        try {
            if (!dateRange) return '';
            
            const formatDate = (date: any) => {
                if (!date?.year) return '';
                const month = date.month ? String(date.month).padStart(2, '0') : '01';
                return `${month}/${date.year}`;
            };

            const start = formatDate(dateRange.start);
            const end = dateRange.end?.year ? formatDate(dateRange.end) : 'Presente';
            
            return `${start} - ${end}`;
        } catch (error) {
            console.error('Erro ao formatar data:', error);
            return '';
        }
    }

    private mapSkillsToExperiences(experiences: IExperience[], skills: ISkill[]): IExperience[] {
        const skillKeywords = skills.map(skill => ({
            original: skill.nome,
            normalized: skill.nome.toLowerCase()
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .replace(/[^a-z0-9\s]/g, '')
        }));
        
        return experiences.map(exp => {
            const expText = `${exp.cargo} ${exp.descricao || ''}`.toLowerCase();
            const matchedSkills = skillKeywords
                .filter(({ normalized }) => {
                    const regex = new RegExp(`\\b${normalized}\\b`, 'i');
                    return regex.test(expText);
                })
                .map(({ original }) => original);
            
            return {
                ...exp,
                skills: matchedSkills
            };
        });
    }

    private getCommonHeaders() {
        const jsessionid = this.extractCookieValue('JSESSIONID')?.replace(/"/g, '');
        const li_at = this.extractCookieValue('li_at');
        
        if (!li_at || !jsessionid) {
            throw new Error('Cookies li_at e JSESSIONID são obrigatórios');
        }

        return {
            'accept': 'application/vnd.linkedin.normalized+json+2.1',
            'accept-language': 'pt-BR,pt;q=0.9,en;q=0.8',
            'cookie': `li_at=${li_at}; JSESSIONID=${jsessionid}`,
            'csrf-token': jsessionid,
            'x-li-lang': 'pt_BR',
            'x-li-page-instance': 'urn:li:page:d_flagship3_profile_view_base',
            'x-restli-protocol-version': '2.0.0',
            'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36',
            'x-li-track': JSON.stringify({
                clientVersion: "1.13.30844",
                mpVersion: "1.13.30844",
                osName: "web",
                timezoneOffset: -3,
                timezone: "America/Sao_Paulo",
                deviceFormFactor: "DESKTOP",
                mpName: "voyager-web",
                displayDensity: 1,
                displayWidth: 1920,
                displayHeight: 1080
            })
        };
    }

    private getAxiosConfig(): AxiosRequestConfig {
        return {
            headers: this.getCommonHeaders(),
            timeout: 30000,
            maxRedirects: 0,
            withCredentials: true,
            validateStatus: (status) => status < 400
        };
    }

    private async debugToken(): Promise<void> {
        try {
            console.log('\n=== Debugando Token LinkedIn ===');
            
            // Extrai e loga os cookies
            const li_at = this.extractCookieValue('li_at');
            const jsessionid = this.extractCookieValue('JSESSIONID');
            
            console.log('Cookies extraídos:', {
                li_at: li_at?.substring(0, 30) + '...',
                jsessionid,
                cookieStringCompleta: this.cookie
            });
            
            // Loga os headers que serão usados
            const headers = this.getCommonHeaders();
            console.log('Headers da requisição:', {
                accept: headers.accept,
                'csrf-token': headers['csrf-token'],
                cookie: headers.cookie?.substring(0, 50) + '...'
            });
            
            // Tenta a requisição
            const testUrl = 'https://www.linkedin.com/voyager/api/me';
            console.log('\nFazendo requisição para:', testUrl);
            
            const response = await axios.get(testUrl, {
                ...this.getAxiosConfig(),
                maxRedirects: 0,
                validateStatus: (status) => true
            });
            
            console.log('\nResposta da API:', {
                status: response.status,
                statusText: response.statusText,
                responseHeaders: {
                    'content-type': response.headers['content-type'],
                    'x-restli-protocol-version': response.headers['x-restli-protocol-version']
                },
                data: typeof response.data === 'object' ? 
                      JSON.stringify(response.data).substring(0, 200) + '...' : 
                      'Resposta não é JSON'
            });

        } catch (error) {
            console.error('\n=== Erro ao debugar token ===');
            if (axios.isAxiosError(error)) {
                console.error('Status:', error.response?.status);
                console.error('Mensagem:', error.message);
                console.error('Response headers:', error.response?.headers);
                console.error('Response data:', error.response?.data);
                console.error('Request config:', {
                    url: error.config?.url,
                    method: error.config?.method,
                    headers: error.config?.headers
                });
            } else {
                console.error('Erro não-Axios:', error);
            }
        }
    }

    private extractSkillLevel(skill: any): string {
        try {
            if (skill.endorsementCount >= 10) return 'Avançado';
            if (skill.endorsementCount >= 5) return 'Intermediário';
            return 'Básico';
        } catch (error) {
            return 'Não especificado';
        }
    }

    public async validateToken(): Promise<boolean> {
        try {
            console.log('=== Validando Token ===');
            
            // Usa a API do Voyager que é usada pelo próprio LinkedIn
            const response = await axios.get('https://www.linkedin.com/voyager/api/me', {
                headers: this.getCommonHeaders(),
                maxRedirects: 5,
                validateStatus: (status) => status < 400
            });
            
            console.log('Resposta da validação:', {
                status: response.status,
                hasData: !!response.data,
                contentType: response.headers['content-type']
            });
            
            return response.status === 200;
        } catch (error) {
            console.error('Erro ao validar token:', {
                isAxiosError: axios.isAxiosError(error),
                status: axios.isAxiosError(error) ? error.response?.status : undefined,
                message: error instanceof Error ? error.message : 'Erro desconhecido',
                headers: axios.isAxiosError(error) ? error.response?.headers : undefined
            });
            
            await this.debugToken(); // chama o método de debug para mais informações
            return false;
        }
    }
}