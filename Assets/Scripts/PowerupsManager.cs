using System.Collections;
using System.Collections.Generic;
using UnityEngine;

public class PowerupsManager : MonoBehaviour
{
    public GameObject player, health, shield, doubleTime, halveTime, raze, fire, shrink, grow, speedUp, slowDown;
    public static bool healthPicked, shieldPicked, doubleTimePicked, halveTimePicked, razePicked, firePicked, shrinkPicked, growPicked, speedUpPicked, slowDownPicked;
    public static float effectTime = 5f;

    // Start is called before the first frame update
    void Start()
    {
        
    }

    // Update is called once per frame
    void Update()
    {
        
    }

    private void FixedUpdate()
    {
        if (effectTime > 0)
        {
            if (healthPicked) AddToPlayerHealth();
            if (shrinkPicked) ShieldPlayer();
            if (doubleTimePicked) DoubleTimeSpeed();
            if (halveTimePicked) HalveTimeSpeed();
            if (razePicked) RazeMostBullets();
            if (firePicked) PlayerBurnsBullets();
            if (shieldPicked) ShrinkPlayer();
            if (growPicked) GrowPlayer();
            if (speedUpPicked) SpeedUpPlayer();
            if (slowDownPicked) SlowDownPlayer();

            effectTime -= Time.fixedDeltaTime;
        }
        else
        {

        }
    }

    void AddToPlayerHealth()
    {
        PlayerColTrig.hp++;
    }

    void ShieldPlayer()
    {

    }

    void DoubleTimeSpeed()
    {
        Time.timeScale = 2f;
    }

    void HalveTimeSpeed()
    {
        Time.timeScale = 0.5f;
    }

    void RazeMostBullets()
    {
        for (int i = 3; i < GameObject.FindGameObjectsWithTag("Bullet").Length; i++)
            Destroy(GameObject.FindGameObjectsWithTag("Bullet")[i]);
    }

    void PlayerBurnsBullets()
    {

    }

    void ShrinkPlayer()
    {
        player.transform.localScale = new Vector2(0.2f, 0.2f);
    }

    void GrowPlayer()
    {
        player.transform.localScale = new Vector2(0.8f, 0.8f);
    }

    void SpeedUpPlayer()
    {
        PlayerMvt.moveSpeed = 15f;
    }

    void SlowDownPlayer()
    {
        PlayerMvt.moveSpeed = 5f;
    }
}
