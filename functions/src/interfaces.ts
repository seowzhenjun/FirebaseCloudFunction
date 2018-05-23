/********************************************************************************************
 * Object interface to be used in various function                                          *
 *                                                                                          *
 * Written by : Zhen Jun Seow                                                               *
 * Depart of Electrical and Computer System Engineering (ECSE), Monash University Australia *
 * Last edited : 23/05/2018                                                                 *
 ********************************************************************************************/

export interface userData{
    userName : string;
    refreshToken : string;
    key : string;
}

export interface notificationObj{
    sender  : string;
    title   : string;
    snippet : string;
}