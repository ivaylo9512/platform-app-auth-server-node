import LoginInput from "../resolvers/types/login-input";
import User from "../entities/user-entity";
import argon2 from 'argon2';
import UserService from "./base/user-service";
import RegisterInput from "../resolvers/types/register-input";
import { v4 } from 'uuid';
import { FORGOT_PASSWORD } from '../constants';
import { Redis } from 'ioredis';
import UpdateInput from "../resolvers/types/update-input";
import { verify } from "jsonwebtoken";
import RefreshToken from "../entities/refresh-token";
import UnauthorizedException from "../exceptions/unauthorized";
import UserRepositoryImpl from '../repositories/user-repository-impl'

export default class UserServiceImpl implements UserService {
    repo: UserRepositoryImpl;
    redis: Redis;

    constructor(repo: UserRepositoryImpl, redis: Redis){
        this.repo = repo;
        this.redis = redis;
    }
        
    async findById(id: number, loggedUser: User): Promise<User>{
        if(id != loggedUser.id && loggedUser.role != 'admin'){
            throw new UnauthorizedException('Unauthorized.');
        }
        
        return await this.repo.findById(id);
    }

    async findByUsername(username: string){
        return await this.repo.findByUsername(username)
    }

    async findByUsernameOrEmail(username: string, email: string){
        return await this.repo.findByUsernameOrEmail(username, email)
    }

    async login(userInput: LoginInput){
        let { username, password, email } = userInput; 

        const user = await this.repo.findUser(username ? 
            { username } : { email } 
        )
        
        if(!user || !await argon2.verify(user.password, password)) {
            throw new UnauthorizedException('Incorrect username, pasword or email.')
        }
        return user
    }

    async register(registerInput: RegisterInput){
        let { username, password, firstName, lastName, birth, email } =  registerInput;

        password = await argon2.hash(password);
        const user = this.repo.createUser({ 
            username, 
            password,
            firstName, 
            lastName,
            birth: new Date(birth),
            email
        })

        await this.repo.flush();
        
        return user;
    }

    async createMany(usersInputs: RegisterInput[]){
        const users = await Promise.all(usersInputs.map(async({ username, password, firstName, lastName, birth, email, role }) => this.repo.create({
            username,
            password: await argon2.hash(password),
            firstName,
            lastName,
            birth: new Date(birth),
            email,
            role
        })));

        await this.repo.persist(users).flush();

        return users;
    }

    async update(updateInput: UpdateInput, foundUser: User){
        let { username, firstName, lastName, birth, email } =  updateInput;

        foundUser.username = username;
        foundUser.firstName = firstName;
        foundUser.lastName = lastName;
        foundUser.birth = new Date(birth);
        foundUser.email = email;

        this.repo.update(foundUser);
        await this.repo.flush();

        return foundUser;
    }

    async delete(id: number, loggedUser: User){
        if(id != loggedUser.id && loggedUser.role != 'admin'){
            throw new UnauthorizedException('Unauthorized.');
        }

        return !!await this.repo.deleteById(id);
    }

    async forgotPassword(email: string){
        const user = await this.repo.findOne({ email })
        if(!user){
            return false;
        }

        const token = v4();
        await this.redis.set(FORGOT_PASSWORD + token, user.id, 'expire', 1000 * 60 * 60);
                
        // await sendEmail(email, `<a href="http://localhost:3000/change-password/${token}>change password</a>`)
        
        return true;
    }

    async verifyLoggedUser(id: number){
        if(!id){
            throw new UnauthorizedException('Unauthorized');
        }

        const user = await this.repo.findOne({ id });

        if(!user){
            throw new UnauthorizedException('User from token is unavailable.');
        }

        return user;
    }
}