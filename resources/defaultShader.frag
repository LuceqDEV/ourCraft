#version 430 core
#extension GL_ARB_bindless_texture: require

layout (location = 0) out vec4 out_color;

layout(binding = 0) uniform sampler2D u_texture;
layout(binding = 1) uniform sampler2D u_numbers;

in vec2 v_uv;
in float v_ambient;

in flat uvec2 v_textureSampler;
in flat uvec2 v_normalSampler;
in flat uvec2 v_materialSampler;
in flat int v_ambientInt;

in flat int v_skyLight;
in flat int v_normalLight;

uniform int u_showLightLevels;

uniform vec3 u_pointPosF;
uniform ivec3 u_pointPosI;
uniform vec3 u_sunDirection;

uniform float u_metallic;
uniform float u_roughness;
uniform float u_exposure;
uniform int u_underWater;

in vec4 v_fragPos;
in flat ivec3 v_blockPos;

uniform float u_fogDistance = 10 * 16 / 2;
const float fogGradient = 32;
const float fogGradientUnderWater = 2;
const float fogUnderWaterMaxDistance = 20;

uniform vec3 u_waterColor;

uniform sampler2D u_depthTexture;
uniform int u_depthPeelwaterPass = 0;
uniform int u_hasPeelInformation = 0;

uniform sampler2D u_PeelTexture;
uniform sampler2D u_dudv;
uniform sampler2D u_dudvNormal;

uniform float u_waterMove;
uniform sampler2D u_caustics;

in flat int v_flags;

float computeFog(float dist)
{
	float rez = exp(-pow(dist*(1/u_fogDistance), fogGradient));
	if(rez > 0.9){return 1;};
	return rez;
}

float computeFogUnderWater(float dist)
{
	float rez = exp(-pow(dist*(1/fogUnderWaterMaxDistance), fogGradientUnderWater));
	return pow(rez,4);
}

readonly restrict layout(std430) buffer u_lights
{
	ivec4 lights[];
};

uniform int u_lightsCount;

uniform ivec3 u_positionInt;
uniform vec3 u_positionFloat;

in flat ivec3 fragmentPositionI;
in vec3 fragmentPositionF;
in flat vec3 v_normal;

const float PI = 3.14159265359;

vec3 compute(ivec3 destI, vec3 destF, ivec3 sourceI, vec3 sourceF)
{
	ivec3 intPart = destI - sourceI;
	vec3 floatPart = destF - sourceF;

	return floatPart + vec3(intPart);
}

float atenuationFunction(float dist)
{
	float maxDist = 15;
	float a = 0.1;

	//if(dist >= maxDist)return 0;
	//return 1;

	return max(0, (maxDist-dist)/(dist*dist*a+maxDist));
}


//

//https://github.com/TheRealMJP/BakingLab/blob/master/BakingLab/ACES.hlsl
/*
=================================================================================================

  Baking Lab
  by MJP and David Neubelt
  http://mynameismjp.wordpress.com/

  All code licensed under the MIT license

=================================================================================================
 The code in this file was originally written by Stephen Hill (@self_shadow), who deserves all
 credit for coming up with this fit and implementing it. Buy him a beer next time you see him. :)
*/

// sRGB => XYZ => D65_2_D60 => AP1 => RRT_SAT
mat3x3 ACESInputMat = mat3x3
(
	0.59719, 0.35458, 0.04823,
	0.07600, 0.90834, 0.01566,
	0.02840, 0.13383, 0.83777
);

// ODT_SAT => XYZ => D60_2_D65 => sRGB
mat3x3 ACESOutputMat = mat3x3
(
	 1.60475, -0.53108, -0.07367,
	-0.10208,  1.10813, -0.00605,
	-0.00327, -0.07276,  1.07602
);

vec3 RRTAndODTFit(vec3 v)
{
	vec3 a = v * (v + 0.0245786f) - 0.000090537f;
	vec3 b = v * (0.983729f * v + 0.4329510f) + 0.238081f;
	return a / b;
}

vec3 ACESFitted(vec3 color)
{
	color = transpose(ACESInputMat) * color;
	// Apply RRT and ODT
	color = RRTAndODTFit(color);
	color = transpose(ACESOutputMat) * color;
	color = clamp(color, 0, 1);
	return color;
}

vec3 ACESFilmSimple(vec3 x)
{
	float a = 2.51f;
	float b = 0.03f;
	float c = 2.43f;
	float d = 0.59f;
	float e = 0.14f;
	return clamp((x*(a*x+b))/(x*(c*x+d)+e), 0, 1);

}
//

//https://gamedev.stackexchange.com/questions/22204/from-normal-to-rotation-matrix#:~:text=Therefore%2C%20if%20you%20want%20to,the%20first%20and%20second%20columns.
mat3x3 NormalToRotation(in vec3 normal)
{
	// Find a vector in the plane
	vec3 tangent0 = cross(normal, vec3(1, 0, 0));
	if (dot(tangent0, tangent0) < 0.001)
		tangent0 = cross(normal, vec3(0, 1, 0));
	tangent0 = normalize(tangent0);
	// Find another vector in the plane
	vec3 tangent1 = normalize(cross(normal, tangent0));
	// Construct a 3x3 matrix by storing three vectors in the columns of the matrix

	return mat3x3(tangent0,tangent1,normal);

	//return ColumnVectorsToMatrix(tangent0, tangent1, normal);
}


vec2 getDudvCoords()
{
	vec2 samplingPoint = - v_blockPos.zx + vec2(v_uv.x + u_waterMove, v_uv.y + u_waterMove/2);
	return samplingPoint * (1/20.f);
}

vec2 getDudvCoords2()
{
	vec2 samplingPoint = - v_blockPos.zx + vec2(v_uv.x + u_waterMove + 3, v_uv.y + u_waterMove/2 + 5);
	samplingPoint.y = -samplingPoint.y;
	return samplingPoint * 0.1;
}

uniform float u_near;
uniform float u_far;

float linearizeDepth(float d)
{
	return 2 * u_near * u_far / (u_far + u_near - (2*d-1.f) * (u_far - u_near) );
}

float getLastDepthLiniarized(vec2 p)
{
	float lastDepth = texture(u_depthTexture, p).x;
	float linear = linearizeDepth(lastDepth);
	return linear;	
}

vec3 applyNormalMap(vec3 inNormal)
{
	vec3 normal;
	if(u_hasPeelInformation != 0 && ((v_flags & 1) != 0))
	{
		normal = texture(sampler2D(u_dudvNormal), getDudvCoords()).rgb;
		normal += texture(sampler2D(u_dudvNormal), getDudvCoords2()).rgb;
		normal = normalize(normal);
	}else
	{
		normal = texture(sampler2D(v_normalSampler), v_uv).rgb;
	}


	normal = normalize(2*normal - 1.f);
	mat3 rotMat = NormalToRotation(inNormal);
	normal = rotMat * normal;
	normal = normalize(normal);
	return normal;
}

float GeometrySchlickGGX(float NdotV, float roughness)
{
	//float r = (roughness + 1.0);
	//float k = (r*r) / 8.0;			//disney

	float k = roughness*roughness / 2;

	float num   = NdotV;
	float denom = NdotV * (1.0 - k) + k;
	
	return num / max(denom, 0.0000001);
}

//oclude light that is hidded begind small geometry roughnesses
float GeometrySmith(vec3 N, vec3 V, vec3 L, float roughness)
{
	float NdotV = max(dot(N, V), 0.0);
	float NdotL = max(dot(N, L), 0.0);
	float ggx2  = GeometrySchlickGGX(NdotV, roughness);
	float ggx1  = GeometrySchlickGGX(NdotL, roughness);
	
	return ggx1 * ggx2;
}

//n normal
//h halfway vector
//a roughness	(1 rough, 0 glossy) 
//this gets the amount of specular light reflected
float DistributionGGX(vec3 N, vec3 H, float roughness)
{
	//GGX/Trowbridge-Reitz
	//			 a^2
	// ------------------------
	// PI ((N*H)^2 (a^2-1)+1)^2

	float a      = roughness*roughness;
	float a2     = a*a;
	float NdotH  = max(dot(N, H), 0.0);
	float NdotH2 = NdotH*NdotH;
	
	float denom = (NdotH2 * (a2 - 1.0) + 1.0);
	denom = PI * denom * denom;
	
	return  a2 / max(denom, 0.0000001);
}

//cosTheta is the dot between the normal and halfway
//ratio between specular and diffuse reflection
vec3 fresnelSchlick(float cosTheta, vec3 F0)
{
	return F0 + (1.0 - F0) * pow(max(1.0 - cosTheta, 0.0), 5.0);
}
vec3 fresnelSchlickRoughness(float cosTheta, vec3 F0, float roughness)
{
	return F0 + (max(vec3(1.0 - roughness), F0) - F0) * pow(max(1.0 - cosTheta, 0.0), 5.0);
}   

vec3 fSpecular(vec3 normal, vec3 halfwayVec, vec3 viewDir, 
vec3 lightDirection, float dotNVclamped, float roughness, vec3 F)
{
	//fCook-Torrance
	float NDF = DistributionGGX(normal, halfwayVec, roughness);       
	float G   = GeometrySmith(normal, viewDir, lightDirection, roughness);   
	float denominator = 4.0 * dotNVclamped  
		* max(dot(normal, lightDirection), 0.0);
	vec3 specular     = (NDF * G * F) / max(denominator, 0.001);

	return specular;
}

//https://mimosa-pudica.net/improved-oren-nayar.html
vec3 fDiffuseOrenNayar2(vec3 color, float roughness, vec3 L, vec3 V, vec3 N)
{
	float a = roughness;
	float a2 = a*a;
	//vec3 A = 1.f/PI * (1 - 0.5 * a2/(a2 + 0.33) + 0.17*color*a2/(a2+0.13));
	//float B = 0.45*a2/(a2+0.09);

	float A = 1.0/(PI+(PI/2.0-2/3.0)*a);
	float B = PI/(PI+(PI/2.0-2/3.0)*a);

	float s = dot(L,N) - dot(N,L)*dot(N,V);

	float t;
	if(s <= 0)
		t = 1;
	else
		t = max(dot(N,L), dot(N,V));

	return color * (A + B * s/t);
}


//https://github.com/meemknight/gl3d
vec3 computePointLightSource(vec3 lightDirection, float metallic, float roughness, in vec3 lightColor, 
	in vec3 viewDir, in vec3 color, in vec3 normal, in vec3 F0)
{

	float dotNVclamped = clamp(dot(normal, viewDir), 0.0, 0.99);

	vec3 halfwayVec = normalize(lightDirection + viewDir);
	
	vec3 radiance = lightColor; //here the first component is the light color
	
	vec3 F  = fresnelSchlick(max(dot(halfwayVec, viewDir), 0.0), F0);

	vec3 specular = fSpecular(normal, halfwayVec, viewDir, lightDirection, dotNVclamped, roughness, F);

	vec3 kS = F; //this is the specular contribution
	vec3 kD = vec3(1.0) - kS; //the difuse is the remaining specular
	kD *= 1.0 - metallic;	//metallic surfaces are darker
	
	//vec3 diffuse = fDiffuse(color.rgb);
	//vec3 diffuse = fDiffuseOrenNayar(color.rgb, roughness, lightDirection, viewDir, normal);
	vec3 diffuse = fDiffuseOrenNayar2(color.rgb, roughness, lightDirection, viewDir, normal);
	
	float NdotL = max(dot(normal, lightDirection), 0.0);        
	return (kD * diffuse + specular) * radiance * NdotL;

}


float computeLight(vec3 N, vec3 L, vec3 V)
{
	vec3 H = normalize(L + V);
			
	float shininess = 16;
	float spec = pow(max(dot(N, H), 0.0), shininess);
	float diffuse = max(dot(L, N), 0.0); 	
	
	return spec + diffuse;
}

vec3 firstGama(vec3 a)
{
	return pow(a, vec3(2.2));
}

float firstGama(float a)
{
	return pow(a, float(2.2));
}

void main()
{

	//depth peel for underwater stuff
	if(u_depthPeelwaterPass != 0)
	{
		vec2 p = v_fragPos.xy / v_fragPos.w;
		p += 1;
		p/=2;

		if (gl_FragCoord.z <= texture(u_depthTexture, p).x + 0.0000001) 
			discard; //Manually performing the GL_GREATER depth test for each pixel

	}

	
	//load albedo
	vec4 textureColor;
	{
		textureColor = texture(sampler2D(v_textureSampler), v_uv);
		if(textureColor.a < 0.1){discard;}
		//gamma correction
		textureColor.rgb = firstGama(textureColor.rgb);
	}
	
	bool isInWater = ((v_flags & 2) != 0);
	
	//caustics
	vec3 causticsColor = vec3(1);
	if(isInWater)
	{
		vec2 coords = getDudvCoords() * 0.5;
		
		float offset = 0.001;	

		float lightMultiplyer = 5;	

		causticsColor.r = texture(u_caustics, coords + vec2(0,0)).r * lightMultiplyer;
		causticsColor.g = texture(u_caustics, coords + vec2(offset,offset)).g * lightMultiplyer;
		causticsColor.b = texture(u_caustics, coords + vec2(offset,offset)*2.0).b * lightMultiplyer;

		//out_color.rgb = texture(u_caustics, coords).rgb;
		//out_color.a = 1;
		//return ;
		//todo water uvs so the texture is continuous on all sides
	}
	

	//load material
	float metallic = 0;
	float roughness = 0;
	{
		vec2 materialColor = texture(sampler2D(v_materialSampler), v_uv).rg;
		
		roughness = pow((1 - materialColor.r),2);
		metallic =pow((materialColor.g),0.5);
		
		//roughness = u_roughness;
		//metallic = u_metallic;

		roughness = clamp(roughness, 0.09, 0.99);
		metallic = clamp(metallic, 0.0, 0.98);
	}


	vec3 finalColor = vec3(0);

	vec3 N = applyNormalMap(v_normal);
	vec3 V = compute(u_positionInt, u_positionFloat, fragmentPositionI, fragmentPositionF);
	float viewLength = length(V);
	V /= viewLength;

	vec3 F0 = vec3(0.04); 
	F0 = mix(F0, textureColor.rgb, vec3(metallic));
	

	for(int i=0; i< u_lightsCount; i++)
	{
		vec3 L = compute(lights[i].rgb, vec3(0), fragmentPositionI, fragmentPositionF);
		//vec3 L =compute(u_pointPosI, u_pointPosF, fragmentPositionI, fragmentPositionF);
		
		float menhetanDistance = dot((abs(fragmentPositionI-lights[i].rgb)),vec3(1));
		//float menhetanDistance = dot((abs(L)),vec3(1));

		float LightDist = length(L);
		if((15-menhetanDistance) + 0.1 > v_normalLight){continue;}
		L = normalize(L);		

		//light += computeLight(N,L,V) * atenuationFunction(LightDist)*1.f;
		finalColor += computePointLightSource(L, metallic, roughness, vec3(0.9,0.9,0.9) * causticsColor, V, 
			textureColor.rgb, N, F0) * atenuationFunction(LightDist);
			
	}
	//light = 0;

	//sun light
	if(v_skyLight > 0)
	{
		vec3 L = u_sunDirection;
		//light += computeLight(N,L,V) * 1.f;
		finalColor += computePointLightSource(L, 
			metallic, roughness, vec3(0.9,0.9,0.9) * causticsColor, V, 
			textureColor.rgb, N, F0);
	}


	//out_color = vec4(textureColor.rgb*(v_color+light),textureColor.a);
	out_color = vec4(finalColor,textureColor.a);
		
	//ambient
	float computedAmbient = firstGama(v_ambient);
	if(isInWater)
	{
		computedAmbient *= 0.9;
	}

	out_color.rgb += textureColor.rgb * computedAmbient ;
	
	
	if(u_showLightLevels != 0)
	{
		vec4 numbersColor = texture(u_numbers, vec2(v_uv.x / 16.0 + (1/16.0)*v_ambientInt, v_uv.y));
		if(numbersColor.a > 0.1)
		{out_color.rgb = mix(firstGama(numbersColor.rgb), out_color.rgb, 0.5);}
	}
	
	out_color = clamp(out_color, vec4(0), vec4(1));

	if(u_underWater != 0)
	{
		out_color.rgb = mix(u_waterColor.rgb, out_color.rgb, 
							vec3(computeFogUnderWater(viewLength)) * 0.5 + 0.5
						);
	}

	//gamma correction + HDR
	out_color.rgb = ACESFitted(out_color.rgb * u_exposure);
	out_color.rgb = pow(out_color.rgb, vec3(1/2.2));
	


	{
		out_color.a *= computeFog(viewLength);	
	}
	
	//is water	
	if(((v_flags & 1) != 0))
	{
		//float reflectivity = dot(V, N);
		float reflectivity = 0.5;

		if(u_hasPeelInformation != 0)
		{
			vec2 p = v_fragPos.xy / v_fragPos.w;
			p += 1;
			p/=2;


			float currentDepth = linearizeDepth(gl_FragCoord.z);		
			float lastDepth = getLastDepthLiniarized(p);
			float waterDepth = lastDepth - currentDepth;
			
			vec2 dudv = vec2(0);
			dudv += texture(sampler2D(u_dudv), getDudvCoords()).rg;
			dudv += texture(sampler2D(u_dudv), getDudvCoords2()).rg;
			vec2 dudvConv = (dudv * 2) - 1;
			vec2 distorsionCoord = dudvConv * 0.009;	

			float distortDepth = getLastDepthLiniarized(p + distorsionCoord);
			float distortWaterDepth = distortDepth - currentDepth;

			vec3 currentColor = out_color.rgb;

			vec3 peelTexture = vec3(1,0.5,0.5);
			float finalDepth = 0;			
			if(distortDepth < currentDepth + 0.1)
			{
				//geometry in front of water
				//keep original texture
				peelTexture = texture(u_PeelTexture, p).rgb;
				finalDepth = waterDepth;
			}else
			{
				peelTexture = texture(u_PeelTexture, p + distorsionCoord).rgb;
				finalDepth = distortWaterDepth;
			}

			peelTexture = mix(peelTexture, u_waterColor, 0.6 * clamp(pow(finalDepth/20.0,2),0,1));

			
			//darken deep stuff

			out_color.rgb = mix(peelTexture, currentColor, reflectivity);
			

			//out_color.rgb = vec3(waterDepth/20);
			//out_color.r = (currentDepth) / 10;
			//out_color.g = (lastDepth) / 10;
			//out_color.b = (lastDepth) / 10;
			//out_color.rg = dudv.rg;
			//out_color.b = 0;

			out_color.a = 1;
			//out_color.a = clamp(waterDepth/5,0,1);
			//out_color.r = clamp(waterDepth/5,0,1);
			//out_color.g = clamp(waterDepth/5,0,1);
			//out_color.b = clamp(waterDepth/5,0,1);
		}else
		{
			out_color.a = reflectivity;
		}
	

	}


	//out_color.r = 1-roughness;
	//out_color.g = metallic;
	//out_color.b = 0;
	//out_color.a = 1;
}