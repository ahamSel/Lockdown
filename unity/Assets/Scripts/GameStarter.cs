using System.Collections;
using System.Collections.Generic;
using UnityEngine;

public class GameStarter : MonoBehaviour
{
    public GameObject player, bullet;
    public AdjustWalls adjustWalls;
    public PowerupSpawner powerupSpawner;
    System.Random random = new System.Random();
    float enablePowerupsTime = 13f;

    // Start is called before the first frame update
    void Start()
    {
        int maxX = (int)adjustWalls.cameraWidth;
        int maxY = (int)adjustWalls.cameraHeight;

        bullet.transform.position = new Vector2(random.Next(-maxX + 1, maxX), random.Next(-maxY + 1, maxY));
        while (Vector2.Distance(bullet.transform.position, player.transform.position) < 3f)
            bullet.transform.position = new Vector2(random.Next(-maxX + 1, maxX), random.Next(-maxY + 1, maxY));
    }

    private void FixedUpdate()
    {
        if (bullet != null)
        {
            if (bullet.transform.localScale.x < 0.2f && bullet.transform.localScale.y < 0.2f)
                bullet.transform.localScale += new Vector3(Time.deltaTime, Time.deltaTime) / 8;
            else bullet.GetComponent<BulletBehaviour>().enabled = true;
        }

        if (enablePowerupsTime > 0) enablePowerupsTime -= Time.deltaTime;
        else powerupSpawner.enabled = true;
    }
}
