import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { UserRepositoryInterface, User } from '../../../domain/repositories/user.repository.interface';
import { LoginDto, AuthResponseDto } from '../../dto/auth.dto';
import { UnauthorizedError } from '../../../shared/errors/unauthorized.error';
import { NotFoundError } from '../../../shared/errors/not-found.error';

export class AuthenticateUseCase {
  constructor(
    private readonly userRepository: UserRepositoryInterface,
    private readonly jwtSecret: string
  ) { }

  async execute(data: LoginDto): Promise<AuthResponseDto> {
    // Buscar usuário no banco
    const user: User | null = await this.userRepository.findByEmail(data.email);
    if (!user) {
      throw new NotFoundError('Usuário não encontrado');
    }

    // Verificar senha
    const isPasswordValid = user.password
      ? await bcrypt.compare(data.password, user.password)
      : data.password === user.password;

    // Verificar frase secreta
    const isSecretPhraseValid = user.secretPhrase === data.secretPhrase;

    if (!isPasswordValid || !isSecretPhraseValid) {
      throw new UnauthorizedError('Credenciais inválidas');
    }

    // Gerar token JWT
    const token = jwt.sign(
      {
        userId: user.id,
        isAdmin: user.isAdmin,
        email: user.email
      },
      this.jwtSecret,
      { expiresIn: '7d' }
    );

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        pixKey: user.pixKey,
        balance: user.balance,
        joinedAt: user.createdAt.toISOString(),
        referralCode: user.referralCode,
        isAdmin: user.isAdmin,
        score: user.score || 0,
        cpf: user.cpf,
      },
      token,
    };
  }
}