using System.Collections;
using System.Collections.Generic;
using UnityEngine;

public class PowerupSpawner : MonoBehaviour
{
    public AdjustWalls adjustWalls;
    private System.Random random = new System.Random();
    private float[] spawnTimes;
    private float spawnTime;

    int maxX;
    int maxY;

    // Start is called before the first frame update
    void Start()
    {
        spawnTimes = new float[] { 2f, 4f, 6f, 8f, 10f };
        spawnTime = spawnTimes[random.Next(0, spawnTimes.Length)];

        maxX = (int)adjustWalls.cameraWidth;
        maxY = (int)adjustWalls.cameraHeight;

        Instantiate(transform.GetChild(random.Next(0, transform.childCount)), 
            new Vector2(random.Next(-maxX + 1, maxX - 1), random.Next(-maxY + 1, maxY - 1)),
            transform.rotation);
    }

    private void FixedUpdate()
    {
        if (spawnTime > 0) spawnTime -= Time.deltaTime;
        else
        {
            for (int i = 0; i < random.Next(1, 5); i++)
                Instantiate(transform.GetChild(random.Next(0, transform.childCount)),
                    new Vector2(random.Next(-maxX + 1, maxX - 1), random.Next(-maxY + 1, maxY - 1)),
                    transform.rotation);  
            spawnTime = spawnTimes[random.Next(0, spawnTimes.Length)];
        }
    }
}
