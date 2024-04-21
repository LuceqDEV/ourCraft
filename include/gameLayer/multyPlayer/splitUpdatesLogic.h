#pragma once
#include <worldGenerator.h>
#include <multyPlayer/chunkSaver.h>
#include <multyPlayer/serverChunkStorer.h>
#include <thread>


struct ThreadPool
{
	
	constexpr static int MAX_THREADS = 12;

	int currentCounter = 0;
	
	std::thread threads[MAX_THREADS];
	std::atomic_bool running[MAX_THREADS] = {};
	std::atomic_bool threIsWork[MAX_THREADS] = {};

	void setThreadsNumber(int nr);

	void setThrerIsWork();

	void waitForEveryoneToFinish();
};


void closeThreadPool();

void splitUpdatesLogic(float tickDeltaTime, std::uint64_t currentTimer,
	ServerChunkStorer &chunkCache, unsigned int seed);


