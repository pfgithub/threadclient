import cors from "cors";
import initExpress from "express";
import init_http from "http";
import { MongoClient } from "mongodb";
import { Server as SocketIOServer } from "socket.io";

const mongo = new MongoClient("ABCDEFG");

const express = initExpress();

const http = init_http.createServer(express);

const io = new SocketIOServer(http);

express.use(cors());

(async () => {
    await mongo.connect();
    const collection = mongo.db("jsoneditor").collection("data");
    console.log("Listening", http.address());

    () => io;
    () => collection;
})().catch(e => {
    console.error(e);
});