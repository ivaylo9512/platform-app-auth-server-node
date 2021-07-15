import { Router, Response } from "express";
import { UserRequest } from "src/types";
import { getToken, getRefreshToken, COOKIE_OPTIONS, refreshExpiry } from '../authentication/authenticate'
import User from "../entities/user";
import { refreshSecret } from "../authentication/authenticate";
import { JwtUser } from "../authentication/jwt-user";
import UnauthorizedException from "src/expceptions/unauthorized";

const router = Router();

router.get('/findById/:id', async(req: UserRequest, res) => {
    res.send(await req.service?.findById(Number(req.params.id)));
})

router.post('/create/', async(req: UserRequest, res) => {
    res.send(await req.service?.register(req.body));
})

router.patch('/update', async(req: UserRequest, res) => {
    res.send(await req.service?.update(req.body));
})

router.delete('/delete/:id', async(req: UserRequest, res) => {
    res.send(await req.service?.delete(Number(req.params.id)));
})

router.post('/login', async(req: UserRequest, res: Response) => {
    const userResponse = await req.service?.login(req.body);
    const user = userResponse?.user;

    if(user){
        setTokens(res, user, req);
    }

    res.send(userResponse);
})
router.post('/register', async(req: UserRequest, res) => {
    const userResponse = await req.service?.register(req.body);
    const user = userResponse?.user;
    
    if(user){
        setTokens(res, user, req);
    }

    res.send(user);
})

router.get('/refreshToken', async(req: UserRequest, res) => {
    const { signedCookies: { refreshToken } } = req

    if(refreshToken){
        try {
            const user = await req.service?.getUserFromToken(refreshToken, refreshSecret);
            if(!user){
                throw new UnauthorizedException('Unauthorized.');
            }
        
            const token = getToken(user)

            res.header('Access-Control-Expose-Headers', 'Authorization'); 
            res.header('Authorization', token);
        }catch(err){
            throw new UnauthorizedException('Incorrect refresh token.');
        }
    }else{
        throw new UnauthorizedException('Refresh token is missing.');
    }
    
    res.send();
})

const setTokens = (res: Response, user: User, req: UserRequest) => {
    const token = getToken(new JwtUser(user))
    const refreshToken = getRefreshToken(new JwtUser(user));

    req.service?.addToken(user, refreshToken, refreshExpiry / 60 / 60 / 24)

    res.cookie("refreshToken", refreshToken, COOKIE_OPTIONS);
    res.header('Access-Control-Expose-Headers', 'Authorization'); 
    res.header('Authorization', token);
}

export default router;