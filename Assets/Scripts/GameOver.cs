using System.Collections;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.SceneManagement;

public class GameOver : MonoBehaviour
{
    GameObject player;
    float timeToRestart = 3f;

    // Start is called before the first frame update
    void Start()
    {
        player = GameObject.FindGameObjectWithTag("Player");
    }

    private void FixedUpdate()
    {
        if (!player || !GameObject.FindGameObjectWithTag("Bullet"))
            if (timeToRestart > 0) timeToRestart -= Time.deltaTime / Time.timeScale;
            else {
                Time.timeScale = 1f;
                Time.fixedDeltaTime = 0.02f;
                SceneManager.LoadScene(SceneManager.GetActiveScene().name);
            }
    }
}
