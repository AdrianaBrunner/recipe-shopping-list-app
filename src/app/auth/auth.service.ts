import { HttpClient } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { BehaviorSubject, Subject, throwError } from "rxjs";
import { catchError, tap } from "rxjs/operators";
import { User } from "./user.model";
import { Router } from "@angular/router";

export interface AuthResponseData {
  kind: string;
  idToken: string;
  email: string;
  refreshToken: string;
  expiresIn: string;
  localId: string;
  registered?: boolean;
}

@Injectable({ providedIn: "root" })
export class AuthService {
  user = new BehaviorSubject<User>(null);
  private tokenExpirationTimer: any;

  constructor(
    private http: HttpClient,
    private router: Router
  ) {}

  signUp(email: string, password: string) {
    return this.http.post<AuthResponseData>('https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=AIzaSyB8_7Hg5vg1MciWbK_78oVUlG0QMVIx42g', 
      {
        email: email, 
        password: password, 
        returnSecureToken: true}
    ).pipe(catchError(this.handleError), 
      tap(resData => {
        this.handleAuthentication(resData.email, resData.localId, resData.idToken, +resData.expiresIn);
      })
    )
  }

  login(email: string, password: string) {
    return this.http.post<AuthResponseData>(
      'https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=AIzaSyB8_7Hg5vg1MciWbK_78oVUlG0QMVIx42g',
      {
        email: email, 
        password: password, 
        returnSecureToken: true
      }
    ).pipe(catchError(this.handleError),
      tap(resData => {
        this.handleAuthentication(resData.email, resData.localId, resData.idToken, +resData.expiresIn);
      })
    )
  }

  autoLogin() {
    const userData: {
      email: string;
      id: string;
      _token: string;
      _tokenExpirationDate: string;
    } = JSON.parse(localStorage.getItem('userData'));
    if (!userData) {
      return;
    }

    const loadedUser = new User(userData.email, userData.id, userData._token, new Date(userData._tokenExpirationDate));

    if (loadedUser.token) {
      this.user.next(loadedUser);
      const expirationDuration = new Date(userData._tokenExpirationDate).getTime() - new Date().getTime();
      this.autoLogout(expirationDuration);
    }
  }

  logout() {
    this.user.next(null);
    this.router.navigate(['/auth']);
    localStorage.removeItem('userData');
    if (this.tokenExpirationTimer) {
      clearTimeout(this.tokenExpirationTimer);
    }
    this.tokenExpirationTimer = null;
  }

  autoLogout(expirationDuration: number) {
    this.tokenExpirationTimer = setTimeout(() => {
      this.logout();
    }, expirationDuration);
  }

  private handleAuthentication(email: string, userId: string, token: string, expiresIn: number) {
    const expirationDate = new Date(new Date().getTime() + expiresIn * 1000);
    const user = new User(email, userId, token, expirationDate);
    this.user.next(user);
    this.autoLogout(expiresIn * 1000);
    localStorage.setItem('userData', JSON.stringify(user));
  }

  private handleError(errorMsg: any) {
    let error = 'An unknown error occurred!';

    if (!errorMsg.error || !errorMsg.error.error) {
      return throwError(error);
    } else {
      switch (errorMsg.error.error.message) {
        case 'EMAIL_EXISTS':
          error = 'This email already exists!';
          break;
        case 'OPERATION_NOT_ALLOWED':
          error = 'Password sign-in is disabled for this project!';
          break;
        case 'TOO_MANY_ATTEMPTS_TRY_LATER':
          error = 'We have blocked all requests from this device due to unusual activity. Try again later.';
          break;
        case 'INVALID_LOGIN_CREDENTIALS':
          error = 'The email or password is incorrect!';
          break;
        case 'INVALID_PASSWORD':
          error = 'This password is not correct!';
          break;
        case 'USER_DISABLED':
          error = 'This user account has been disabled by an administrator!';
          break;
      }
    }
    return throwError(error);
  }
}