import { Resolver, Ctx, Arg, Mutation, Query } from 'type-graphql';
import User from '../entities/User';
import { ApolloContext } from "src/types";
import argon2 from 'argon2';
import UserResponse from './types/UserResponse';
import UserInput from './types/UserInput';

@Resolver()
export default class UserResolver{
    @Query(() => UserResponse)
    async findById(
        @Arg('id') id: number,
        @Ctx() { em }: ApolloContext
    ): Promise<UserResponse> {
        const user = await em.findOne(User, { id })
        if(!user){
            return{
                errors:[{
                    field: 'id',
                    message: `Entity with id: ${id} doesn't exist.`
                }]
            }
        }
        //Todo check token id vs find userId or role admin
        return {
            user
        }
    }

    @Mutation(() => UserResponse)
    async login(
        @Arg('userInput') userInput: UserInput,
        @Ctx() { em }: ApolloContext
    ): Promise<UserResponse> {
        const password = await argon2.hash(userInput.password);
        const user = await em.findOne(User, { username: userInput.username, password })
        if(!user) {
            return {
                errors: [{
                    field: 'username',
                    message: 'Incorrect username or password.'
                }]
            }
        }
        return {
            user,
        };
    }

    @Mutation(() => UserResponse)
    async register(
        @Arg('userInput') userInput: UserInput,
        @Ctx() { em }: ApolloContext
    ): Promise<UserResponse> {
        if(userInput.username.length < 7){
            return {
                errors: [{ 
                    field: 'username', 
                    message: 'Username must be more than 7 characters.'
                }]
            }
        }
        if(userInput.password.length < 10){
            return {
                errors: [{ 
                    field: 'username', 
                    message: 'Username must be more than 10 characters.'
                }]
            }
        }
        const password = await argon2.hash(userInput.password);
        const user = em.create(User, { 
            username: userInput.username, 
            password 
        })
        try{
            em.persistAndFlush(user);
        }catch(err){
            if(err.code === '23505' || err.details.includes('already exists')){
                return{
                    errors: [{
                        field: 'username',
                        message: 'Username has already been taken'
                    }]
                }
            }
        }
        return {
            user
        };
    }
}