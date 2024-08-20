#pragma once

#include <glad/glad.h>
#include "rendering/shader.h"
#include <glm/vec3.hpp>
#include "rendering/camera.h"
#include <gl2d/gl2d.h>

struct SkyBox
{
	GLuint texture = 0;				//environment cubemap
	GLuint convolutedTexture = 0;	//convoluted environment (used for difuse iradiance)
	GLuint preFilteredMap = 0;		//multiple mipmaps used for speclar 
	glm::vec3 color = {1,1,1};
	void clearTextures();
};

struct SkyBoxLoaderAndDrawer
{
	GLuint vertexArray = 0;
	GLuint vertexBuffer = 0;
	GLuint captureFBO;

	void createGpuData();

	struct
	{
		Shader shader;
		GLuint modelViewUniformLocation;
		GLuint u_sunPos;
		GLuint u_blend;
		GLuint u_rotation1;
		GLuint u_rotation2;
	}normalSkyBox;

	struct
	{
		Shader shader;
		GLuint u_equirectangularMap;
		GLuint modelViewUniformLocation;

	}hdrtoCubeMap;

	struct
	{
		Shader shader;
		GLuint u_environmentMap;
		GLuint u_sampleQuality;
		GLuint modelViewUniformLocation;

	}convolute;

	struct
	{
		Shader shader;
		GLuint u_environmentMap;
		GLuint u_roughness;
		GLuint u_sampleCount;
		GLuint modelViewUniformLocation;

	}preFilterSpecular;


	enum CrossskyBoxFormats
	{
		BottomOfTheCrossRight,
		BottomOfTheCrossDown,
		BottomOfTheCrossLeft,
	};

	void loadAllTextures(std::string path);

	void clearOnlyTextures();
	
	void loadTexture(const char *name, SkyBox &skyBox, int format = 0);
	void loadHDRtexture(const char *name, SkyBox &skyBox, GLuint frameBuffer);
	

	//, GLuint frameBuffer is the default fbo
	void createConvolutedAndPrefilteredTextureData(SkyBox &skyBox,
		float sampleQuality = 0.025, unsigned int specularSamples = 1024);


	SkyBox daySky;
	SkyBox nightSky;
	SkyBox twilightSky;
	gl2d::Texture sunTexture;
	gl2d::Texture moonTexture;


	void drawBefore(const glm::mat4 &viewProjMat, 
		glm::vec3 sunPos, float timeOfDay);


	void clearOnlyGPUdata();
};


struct SunRenderer
{

	GLuint vertexBuffer = 0;
	GLuint vao = 0;

	
	void create();

	Shader shader = {};
	GLuint u_modelViewProjectionMatrix = 0;

	void render(Camera camera, glm::vec3 sunPos,
		gl2d::Texture sunTexture);

	void clear();

};


glm::vec3 calculateSunPosition(float dayTime);


/*

"right.jpg",
"left.jpg",
"top.jpg",
"bottom.jpg",
"front.jpg",
"back.jpg"

*/

