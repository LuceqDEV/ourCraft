#pragma once 
#include <FastNoiseSIMD.h>
#include <splines.h>
#include <string>

struct NoiseSetting
{
	float scale = 0.35;
	int type = FastNoiseSIMD::NoiseType::SimplexFractal;
	int cellularReturnType = FastNoiseSIMD::CellularReturnType::Distance;
	float frequency = 0.015;
	int octaves = 3;
	int perturbFractalOctaves = 0;

	float power = 1;

	Spline spline;

	std::string saveSettings(int tabs, bool saveSpline = true);

	void sanitize();
};

struct WorldGeneratorSettings
{

	int seed = 1234;
	NoiseSetting continentalnessNoiseSettings;
	NoiseSetting peaksAndValies;
	NoiseSetting wierdness;
	NoiseSetting stone3Dnoise;
	NoiseSetting riversNoise;
	NoiseSetting roadsNoise;
	NoiseSetting temperatureNoise;
	NoiseSetting spagettiNoise;
	NoiseSetting hillsDrops;
	NoiseSetting randomSand;
	NoiseSetting stonePatches;
	NoiseSetting treesAmountNoise;
	NoiseSetting lakesNoise;
	NoiseSetting treesTypeNoise;
	NoiseSetting cavesNoise;

	Spline peaksAndValiesContributionSpline;
	Spline regionsHeightSpline;

	NoiseSetting vegetationNoise;

	float densityBias = 0.1;
	float densityBiasPower = 1;
	float densitySquishFactor = 1;
	float densitySquishPower = 1;
	int densityHeightoffset = 1;

	float spagettiBias = 0.1;
	float spagettiBiasPower = 1;


	std::string saveSettings();

	void sanitize();

	bool loadSettings(const char *data);
};

struct WorldGenerator
{


	FastNoiseSIMD *regionsHeightNoise;
	FastNoiseSIMD *regionsHeightTranzition;
	FastNoiseSIMD *regionsRandomNumber;
	Spline regionsHeightSplines;



	//

	FastNoiseSIMD *continentalnessNoise;
	Spline continentalSplines;
	float continentalPower = 1.f;

	FastNoiseSIMD *peaksValiesNoise;
	Spline peaksValiesSplines;
	Spline peaksValiesContributionSplines;
	float peaksValiesPower = 1.f;

	FastNoiseSIMD *wierdnessNoise;
	Spline wierdnessSplines;
	//Spline oceansAndTerasesContributionSplines;
	float wierdnessPower = 1.f;

	FastNoiseSIMD *stone3Dnoise;
	Spline stone3DnoiseSplines;
	float stone3Dpower = 1.f;
	float densityBias = 0.1;
	float densityBiasPower = 1;

	float densitySquishFactor = 1;
	float densitySquishPower = 1;
	int densityHeightoffset = 1;
	
	FastNoiseSIMD *spagettiNoise;
	Spline spagettiNoiseSplines;
	float spagettiNoisePower = 1.f; //todo remove?
	float spagettiNoiseBias = 0.1;
	float spagettiNoiseBiasPower = 1;

	FastNoiseSIMD *temperatureNoise;
	Spline temperatureSplines;
	float temperaturePower = 1.f;

	FastNoiseSIMD *riversNoise;
	Spline riversSplines;
	float riversPower = 1.f;

	FastNoiseSIMD *cavesNoise;
	Spline cavesSpline;
	float cavesPower = 1.f;

	FastNoiseSIMD *treesAmountNoise;
	Spline treesAmountSpline;
	float treesAmountPower = 1.f;

	FastNoiseSIMD *treesTypeNoise;
	Spline treesTypeSpline;
	float treesTypePower = 1.f;

	FastNoiseSIMD *hillsDropsNoise;
	Spline hillsDropsSpline;
	float hillsDropsPower = 1.f;

	FastNoiseSIMD *stonePatchesNoise;
	Spline stonePatchesSpline;
	float stonePatchesPower = 1.f;

	FastNoiseSIMD *roadNoise;
	Spline roadSplines;
	float roadPower = 1.f;


	FastNoiseSIMD *lakesNoise;
	Spline lakesSplines;
	float lakesPower = 1.f;

	FastNoiseSIMD *whiteNoise;

	FastNoiseSIMD *whiteNoise2;

	FastNoiseSIMD *randomStonesNoise;

	FastNoiseSIMD *randomSandPatchesNoise;
	Spline randomSandSplines;
	float randomSandPower = 1.f;


	void init();
	void clear();

	void applySettings(WorldGeneratorSettings &s);

	int getRegionHeightForChunk(int chunkX, int chunkZ);

	int getRegionHeightAndBlendingsForChunk(int chunkX, int chunkZ, float values[16*16],
		float borderingFactor[16 * 16], float &vegetationMaster);

};